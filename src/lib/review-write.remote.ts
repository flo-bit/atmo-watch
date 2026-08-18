import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { createTID } from '@svelte-atproto/oauth/helper';
import type { Client } from '@atcute/client';
import { isCanonicalResourceUri, parseCanonicalResourceUri } from '@atcute/lexicons';
import type { CanonicalResourceUri, Did } from '@atcute/lexicons';
import * as v from 'valibot';
import { contrail } from '$lib/contrail-active';
import type { Main as ListRecord } from '$lib/contrail/types/types/social/popfeed/feed/list';
import type { Main as ListItemRecord } from '$lib/contrail/types/types/social/popfeed/feed/listItem';
import type { Main as ReviewRecord } from '$lib/contrail/types/types/social/popfeed/feed/review';
import { backdropUrl } from '$lib/images';
import { getReviewRecordMetadata } from '$lib/tmdb.server';

const REVIEW_COLLECTION = 'social.popfeed.feed.review';
const LIST_COLLECTION = 'social.popfeed.feed.list';
const LIST_ITEM_COLLECTION = 'social.popfeed.feed.listItem';
const MAX_POSTER_SIZE = 2_000_000;

function isAllowedPosterUrl(value: string) {
	const url = new URL(value);
	return (
		url.protocol === 'https:' &&
		url.hostname === 'image.tmdb.org' &&
		url.pathname.startsWith('/t/p/')
	);
}

const mediaIdentitySchema = v.object({
	creativeWorkType: v.picklist(['movie', 'tv_show']),
	tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1))
});

const mediaSchema = v.object({
	...mediaIdentitySchema.entries,
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1000)),
	posterUrl: v.optional(
		v.pipe(
			v.string(),
			v.url(),
			v.maxLength(2048),
			v.check(isAllowedPosterUrl, 'Poster must use the TMDB image service')
		)
	)
});

const saveReviewSchema = v.object({
	media: mediaSchema,
	rating: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)),
	text: v.pipe(v.string(), v.trim(), v.maxLength(1000)),
	containsSpoilers: v.boolean(),
	markAsWatched: v.boolean()
});

type StoredReviewValue = {
	$type?: unknown;
	identifiers?: { tmdbId?: unknown; [key: string]: unknown };
	creativeWorkType?: unknown;
	rating?: unknown;
	text?: unknown;
	containsSpoilers?: unknown;
	createdAt?: unknown;
	poster?: unknown;
	posterUrl?: unknown;
	backdropUrl?: unknown;
	facets?: unknown;
	genres?: unknown;
	isRevisit?: unknown;
	mainCredit?: unknown;
	mainCreditRole?: unknown;
	releaseDate?: unknown;
	tags?: unknown;
	[key: string]: unknown;
};

type StoredReview = {
	rkey: string;
	cid?: string;
	value: StoredReviewValue;
};

type WatchedList = {
	uri: CanonicalResourceUri;
	listType?: string;
};

type MediaRecordMetadata = Awaited<ReturnType<typeof getReviewRecordMetadata>>;

function responseMessage(data: unknown, fallback: string) {
	if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
		return data.message;
	}
	return fallback;
}

function requireSession() {
	const { locals } = getRequestEvent();
	if (!locals.client || !locals.did) error(401, 'Log in to save a review');
	return { client: locals.client, did: locals.did };
}

async function uploadPoster(client: Client, posterUrl: string) {
	let response: Response;
	try {
		response = await fetch(posterUrl, {
			headers: { accept: 'image/avif,image/webp,image/png,image/jpeg' },
			signal: AbortSignal.timeout(15_000)
		});
	} catch {
		error(502, 'Could not download the poster image');
	}

	if (!response.ok) error(502, 'Could not download the poster image');
	if (!isAllowedPosterUrl(response.url)) error(502, 'The poster image redirected unexpectedly');

	const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
	if (!contentType?.startsWith('image/')) error(422, 'The poster URL did not return an image');

	const declaredSize = Number(response.headers.get('content-length'));
	if (Number.isFinite(declaredSize) && declaredSize > MAX_POSTER_SIZE) {
		error(413, 'The poster image is too large');
	}

	const bytes = await response.arrayBuffer();
	if (bytes.byteLength > MAX_POSTER_SIZE) error(413, 'The poster image is too large');

	const upload = await client.post('com.atproto.repo.uploadBlob', {
		input: new Blob([bytes], { type: contentType })
	});
	if (!upload.ok) {
		error(upload.status, responseMessage(upload.data, 'Could not upload the poster image'));
	}

	return upload.data.blob;
}

async function findWatchedList(
	client: Client,
	did: Did,
	name: string
): Promise<WatchedList | null> {
	let cursor: string | undefined;

	do {
		const response = await client.get('com.atproto.repo.listRecords', {
			params: {
				repo: did,
				collection: LIST_COLLECTION,
				cursor,
				limit: 100,
				reverse: true
			}
		});
		if (!response.ok) {
			error(response.status, responseMessage(response.data, 'Could not load your lists'));
		}

		for (const record of response.data.records) {
			const value = record.value as { $type?: unknown; name?: unknown; listType?: unknown };
			if (
				value.$type !== LIST_COLLECTION ||
				typeof value.name !== 'string' ||
				value.name.trim() !== name ||
				!isCanonicalResourceUri(record.uri)
			) {
				continue;
			}

			const parsed = parseCanonicalResourceUri(record.uri);
			if (parsed.repo !== did || parsed.collection !== LIST_COLLECTION) continue;

			return {
				uri: record.uri,
				...(typeof value.listType === 'string' && value.listType
					? { listType: value.listType }
					: {})
			};
		}

		cursor = response.data.cursor;
	} while (cursor);

	return null;
}

async function hasListItem(
	client: Client,
	did: Did,
	listUri: CanonicalResourceUri,
	media: v.InferOutput<typeof mediaIdentitySchema>
) {
	let cursor: string | undefined;

	do {
		const response = await client.get('com.atproto.repo.listRecords', {
			params: {
				repo: did,
				collection: LIST_ITEM_COLLECTION,
				cursor,
				limit: 100,
				reverse: true
			}
		});
		if (!response.ok) {
			error(response.status, responseMessage(response.data, 'Could not load your list items'));
		}

		for (const record of response.data.records) {
			const value = record.value as {
				$type?: unknown;
				listUri?: unknown;
				creativeWorkType?: unknown;
				identifiers?: { tmdbId?: unknown };
			};
			if (
				value.$type === LIST_ITEM_COLLECTION &&
				value.listUri === listUri &&
				value.creativeWorkType === media.creativeWorkType &&
				value.identifiers?.tmdbId === String(media.tmdbId)
			) {
				return true;
			}
		}

		cursor = response.data.cursor;
	} while (cursor);

	return false;
}

async function createWatchedList(client: Client, did: Did, name: string): Promise<WatchedList> {
	const response = await contrail.authenticated(client).post('com.atproto.repo.createRecord', {
		input: {
			repo: did,
			collection: LIST_COLLECTION,
			rkey: createTID(),
			record: {
				$type: LIST_COLLECTION,
				name,
				listType: 'watched',
				createdAt: new Date().toISOString(),
				ordered: false,
				tags: []
			} as ListRecord
		}
	});
	if (!response.ok) {
		error(response.status, responseMessage(response.data, 'Could not create watched list'));
	}
	if (!isCanonicalResourceUri(response.data.uri)) error(502, 'The list returned an invalid URI');

	const parsed = parseCanonicalResourceUri(response.data.uri);
	if (parsed.repo !== did || parsed.collection !== LIST_COLLECTION) {
		error(502, 'The list returned an invalid URI');
	}

	return { uri: response.data.uri, listType: 'watched' };
}

async function addToWatchedList({
	client,
	did,
	media,
	metadata,
	poster
}: {
	client: Client;
	did: Did;
	media: v.InferOutput<typeof mediaSchema>;
	metadata: MediaRecordMetadata;
	poster: unknown;
}) {
	const listName = media.creativeWorkType === 'movie' ? 'Watched Movies' : 'Watched Shows';
	let list = await findWatchedList(client, did, listName);
	if (list && (await hasListItem(client, did, list.uri, media))) return false;

	list ??= await createWatchedList(client, did, listName);
	const watchedAt = new Date().toISOString();
	const record = {
		$type: LIST_ITEM_COLLECTION,
		listUri: list.uri,
		...(list.listType ? { listType: list.listType } : {}),
		identifiers: {
			tmdbId: String(media.tmdbId),
			...(metadata.imdbId ? { imdbId: metadata.imdbId } : {})
		},
		creativeWorkType: media.creativeWorkType,
		title: metadata.title,
		addedAt: watchedAt,
		completedAt: watchedAt,
		status: '#finished',
		genres: metadata.genres,
		...(poster ? { poster } : {}),
		...(media.posterUrl ? { posterUrl: media.posterUrl } : {}),
		...(backdropUrl(metadata.backdrop, 'original')
			? { backdropUrl: backdropUrl(metadata.backdrop, 'original') }
			: {}),
		...(metadata.releaseDate ? { releaseDate: metadata.releaseDate } : {}),
		...(metadata.mainCredit ? { mainCredit: metadata.mainCredit } : {}),
		...(metadata.mainCreditRole ? { mainCreditRole: metadata.mainCreditRole } : {})
	} as ListItemRecord;

	const response = await contrail.authenticated(client).post('com.atproto.repo.createRecord', {
		input: {
			repo: did,
			collection: LIST_ITEM_COLLECTION,
			rkey: createTID(),
			record
		}
	});
	if (!response.ok) {
		error(response.status, responseMessage(response.data, 'Could not mark as watched'));
	}

	return true;
}

async function findReview(
	client: Client,
	did: Did,
	media: v.InferOutput<typeof mediaIdentitySchema>
): Promise<StoredReview | null> {
	let cursor: string | undefined;

	do {
		const response = await client.get('com.atproto.repo.listRecords', {
			params: {
				repo: did,
				collection: REVIEW_COLLECTION,
				cursor,
				limit: 100,
				reverse: true
			}
		});
		if (!response.ok) {
			error(response.status, responseMessage(response.data, 'Could not load your reviews'));
		}

		for (const record of response.data.records) {
			const value = record.value as StoredReviewValue;
			if (
				value.$type !== REVIEW_COLLECTION ||
				value.creativeWorkType !== media.creativeWorkType ||
				value.identifiers?.tmdbId !== String(media.tmdbId) ||
				!isCanonicalResourceUri(record.uri)
			) {
				continue;
			}

			return {
				rkey: parseCanonicalResourceUri(record.uri).rkey,
				cid: record.cid,
				value
			};
		}

		cursor = response.data.cursor;
	} while (cursor);

	return null;
}

export const loadReviewDraft = command(mediaIdentitySchema, async (media) => {
	const { client, did } = requireSession();
	const existing = await findReview(client, did, media);
	if (!existing) return null;

	return {
		rating:
			typeof existing.value.rating === 'number' &&
			Number.isInteger(existing.value.rating) &&
			existing.value.rating >= 0 &&
			existing.value.rating <= 10
				? existing.value.rating
				: 0,
		text: typeof existing.value.text === 'string' ? existing.value.text : '',
		containsSpoilers:
			typeof existing.value.containsSpoilers === 'boolean' ? existing.value.containsSpoilers : false
	};
});

export const saveReviewRecord = command(saveReviewSchema, async ({ media, ...review }) => {
	const { client, did } = requireSession();
	const existing = await findReview(client, did, media);
	const createdAt =
		typeof existing?.value.createdAt === 'string'
			? existing.value.createdAt
			: new Date().toISOString();

	let metadata: MediaRecordMetadata;
	try {
		metadata = await getReviewRecordMetadata(media.tmdbId, media.creativeWorkType);
	} catch {
		error(502, 'Could not load the media details needed to save this review');
	}

	let poster = existing?.value.poster;
	if (media.posterUrl && (!poster || existing?.value.posterUrl !== media.posterUrl)) {
		poster = await uploadPoster(client, media.posterUrl);
	}

	const record = {
		...(existing?.value ?? {}),
		$type: REVIEW_COLLECTION,
		identifiers: {
			...(existing?.value.identifiers ?? {}),
			tmdbId: String(media.tmdbId),
			...(metadata.imdbId ? { imdbId: metadata.imdbId } : {})
		},
		creativeWorkType: media.creativeWorkType,
		rating: review.rating,
		createdAt,
		title: metadata.title,
		text: review.text,
		containsSpoilers: review.containsSpoilers,
		facets: Array.isArray(existing?.value.facets) ? existing.value.facets : [],
		genres: metadata.genres,
		isRevisit: typeof existing?.value.isRevisit === 'boolean' ? existing.value.isRevisit : false,
		tags: Array.isArray(existing?.value.tags) ? existing.value.tags : [],
		...(poster ? { poster } : {}),
		...(media.posterUrl ? { posterUrl: media.posterUrl } : {}),
		...(backdropUrl(metadata.backdrop, 'original')
			? { backdropUrl: backdropUrl(metadata.backdrop, 'original') }
			: {}),
		...(metadata.releaseDate ? { releaseDate: metadata.releaseDate } : {}),
		...(metadata.mainCredit ? { mainCredit: metadata.mainCredit } : {}),
		...(metadata.mainCreditRole ? { mainCreditRole: metadata.mainCreditRole } : {})
	} as ReviewRecord;

	const authenticated = contrail.authenticated(client);
	const response = existing
		? await authenticated.post('com.atproto.repo.putRecord', {
				input: {
					repo: did,
					collection: REVIEW_COLLECTION,
					rkey: existing.rkey,
					record,
					swapRecord: existing.cid
				}
			})
		: await authenticated.post('com.atproto.repo.createRecord', {
				input: {
					repo: did,
					collection: REVIEW_COLLECTION,
					rkey: createTID(),
					record
				}
			});

	if (!response.ok) {
		error(response.status, responseMessage(response.data, 'Could not save review'));
	}

	const addedToWatched = review.markAsWatched
		? await addToWatchedList({ client, did, media, metadata, poster })
		: false;

	return { uri: response.data.uri, created: !existing, addedToWatched };
});
