import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { createTID } from '@svelte-atproto/oauth/helper';
import type { Client } from '@atcute/client';
import { isCanonicalResourceUri, parseCanonicalResourceUri } from '@atcute/lexicons';
import type { Did } from '@atcute/lexicons';
import * as v from 'valibot';
import { contrail } from '$lib/contrail';
import type { Main as ReviewRecord } from '$lib/contrail/types/types/social/popfeed/feed/review';

const REVIEW_COLLECTION = 'social.popfeed.feed.review';
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
	containsSpoilers: v.boolean()
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
	[key: string]: unknown;
};

type StoredReview = {
	rkey: string;
	cid?: string;
	value: StoredReviewValue;
};

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
	let poster = existing?.value.poster;
	if (media.posterUrl && (!poster || existing?.value.posterUrl !== media.posterUrl)) {
		poster = await uploadPoster(client, media.posterUrl);
	}

	const record = {
		...(existing?.value ?? {}),
		$type: REVIEW_COLLECTION,
		identifiers: {
			...(existing?.value.identifiers ?? {}),
			tmdbId: String(media.tmdbId)
		},
		creativeWorkType: media.creativeWorkType,
		rating: review.rating,
		createdAt,
		title: media.title,
		text: review.text || undefined,
		containsSpoilers: review.containsSpoilers,
		...(poster ? { poster } : {}),
		...(media.posterUrl ? { posterUrl: media.posterUrl } : {})
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

	return { uri: response.data.uri, created: !existing };
});
