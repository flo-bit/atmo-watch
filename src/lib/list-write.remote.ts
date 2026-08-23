import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { createTID } from '@svelte-atproto/oauth/helper';
import type { Client } from '@atcute/client';
import { isCanonicalResourceUri, parseCanonicalResourceUri } from '@atcute/lexicons';
import type { CanonicalResourceUri, Did, Nsid } from '@atcute/lexicons';
import * as v from 'valibot';
import { contrail } from '$lib/contrail-client.server';
import type { Main as ListRecord } from '$lib/contrail/types/types/social/popfeed/feed/list';
import type { Main as ListItemRecord } from '$lib/contrail/types/types/social/popfeed/feed/listItem';
import { backdropUrl } from '$lib/images';
import { getReviewRecordMetadata } from '$lib/tmdb.server';

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

const listUriSchema = v.pipe(
	v.string(),
	v.maxLength(500),
	v.check((value: string) => {
		if (!isCanonicalResourceUri(value)) return false;
		return parseCanonicalResourceUri(value).collection === LIST_COLLECTION;
	}, 'Invalid list URI')
);

const toggleListMembershipSchema = v.object({
	media: mediaSchema,
	listUri: listUriSchema,
	selected: v.boolean()
});

const createListWithItemSchema = v.object({
	media: mediaSchema,
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
	description: v.pipe(v.string(), v.trim(), v.maxLength(500))
});

const setWatchedSchema = v.object({
	media: mediaSchema,
	watched: v.boolean()
});

type RepoRecord = {
	uri: string;
	cid: string;
	value: unknown;
};

type StoredListValue = {
	$type?: unknown;
	name?: unknown;
	listType?: unknown;
	[key: string]: unknown;
};

type StoredListItemValue = {
	$type?: unknown;
	listUri?: unknown;
	creativeWorkType?: unknown;
	identifiers?: { tmdbId?: unknown; [key: string]: unknown };
	[key: string]: unknown;
};

type StoredList = {
	uri: CanonicalResourceUri;
	name: string;
	listType?: string;
};

type StoredListItem = {
	cid: string;
	rkey: string;
	value: StoredListItemValue;
};

type PreparedListItem = {
	metadata: Awaited<ReturnType<typeof getReviewRecordMetadata>>;
	poster?: Awaited<ReturnType<typeof uploadPoster>>;
};

function responseMessage(data: unknown, fallback: string) {
	if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
		return data.message;
	}
	return fallback;
}

function requireSession() {
	const { locals } = getRequestEvent();
	if (!locals.client || !locals.did) error(401, 'Log in to manage lists');
	return { client: locals.client, did: locals.did };
}

function isOwnedRecordUri(
	value: string,
	did: Did,
	collection: Nsid
): value is CanonicalResourceUri {
	if (!isCanonicalResourceUri(value)) return false;
	const parsed = parseCanonicalResourceUri(value);
	return parsed.repo === did && parsed.collection === collection;
}

async function loadRepoRecords(client: Client, did: Did, collection: Nsid) {
	const records: RepoRecord[] = [];
	let cursor: string | undefined;

	do {
		const response = await client.get('com.atproto.repo.listRecords', {
			params: { repo: did, collection, cursor, limit: 100, reverse: true }
		});
		if (!response.ok) {
			error(response.status, responseMessage(response.data, 'Could not load your lists'));
		}

		records.push(...response.data.records);
		cursor = response.data.cursor;
	} while (cursor);

	return records;
}

function toStoredLists(records: RepoRecord[], did: Did) {
	return records.flatMap((record): StoredList[] => {
		const value = record.value as StoredListValue;
		if (
			value.$type !== LIST_COLLECTION ||
			typeof value.name !== 'string' ||
			!isOwnedRecordUri(record.uri, did, LIST_COLLECTION)
		) {
			return [];
		}

		return [
			{
				uri: record.uri,
				name: value.name.trim() || 'Untitled list',
				...(typeof value.listType === 'string' && value.listType
					? { listType: value.listType }
					: {})
			}
		];
	});
}

function toStoredListItems(records: RepoRecord[], did: Did) {
	return records.flatMap((record): StoredListItem[] => {
		const value = record.value as StoredListItemValue;
		if (
			value.$type !== LIST_ITEM_COLLECTION ||
			!isOwnedRecordUri(record.uri, did, LIST_ITEM_COLLECTION)
		) {
			return [];
		}

		return [
			{
				cid: record.cid,
				rkey: parseCanonicalResourceUri(record.uri).rkey,
				value
			}
		];
	});
}

async function loadListData(client: Client, did: Did) {
	const [listRecords, itemRecords] = await Promise.all([
		loadRepoRecords(client, did, LIST_COLLECTION),
		loadRepoRecords(client, did, LIST_ITEM_COLLECTION)
	]);

	return {
		lists: toStoredLists(listRecords, did),
		items: toStoredListItems(itemRecords, did)
	};
}

function isMediaItem(item: StoredListItem, media: v.InferOutput<typeof mediaIdentitySchema>) {
	return (
		item.value.creativeWorkType === media.creativeWorkType &&
		item.value.identifiers?.tmdbId === String(media.tmdbId)
	);
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

async function prepareListItem(
	client: Client,
	media: v.InferOutput<typeof mediaSchema>
): Promise<PreparedListItem> {
	let metadata: PreparedListItem['metadata'];
	try {
		metadata = await getReviewRecordMetadata(media.tmdbId, media.creativeWorkType);
	} catch {
		error(502, 'Could not load the media details needed to update your lists');
	}

	return {
		metadata,
		...(media.posterUrl ? { poster: await uploadPoster(client, media.posterUrl) } : {})
	};
}

async function createList(
	client: Client,
	did: Did,
	name: string,
	description: string,
	listType?: string
): Promise<StoredList> {
	const response = await contrail.authenticated(client).post('com.atproto.repo.createRecord', {
		input: {
			repo: did,
			collection: LIST_COLLECTION,
			rkey: createTID(),
			record: {
				$type: LIST_COLLECTION,
				name,
				...(description ? { description } : {}),
				...(listType ? { listType } : {}),
				createdAt: new Date().toISOString(),
				ordered: false,
				tags: []
			} as ListRecord
		}
	});
	if (!response.ok) {
		error(response.status, responseMessage(response.data, 'Could not create list'));
	}
	if (!isOwnedRecordUri(response.data.uri, did, LIST_COLLECTION)) {
		error(502, 'The list returned an invalid URI');
	}

	return { uri: response.data.uri, name, ...(listType ? { listType } : {}) };
}

async function createListItem(
	client: Client,
	did: Did,
	list: StoredList,
	media: v.InferOutput<typeof mediaSchema>,
	prepared: PreparedListItem
) {
	const { metadata, poster } = prepared;
	const addedAt = new Date().toISOString();
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
		addedAt,
		...(list.listType === 'watched' ? { completedAt: addedAt, status: '#finished' as const } : {}),
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
		error(response.status, responseMessage(response.data, 'Could not add item to list'));
	}

	return response.data.uri;
}

async function deleteListItems(client: Client, did: Did, items: StoredListItem[]) {
	const authenticated = contrail.authenticated(client);
	for (const item of items) {
		const response = await authenticated.post('com.atproto.repo.deleteRecord', {
			input: {
				repo: did,
				collection: LIST_ITEM_COLLECTION,
				rkey: item.rkey,
				swapRecord: item.cid
			},
			as: null
		});
		if (!response.ok) {
			error(response.status, responseMessage(response.data, 'Could not remove item from list'));
		}
	}
}

export const loadListOptions = command(mediaIdentitySchema, async (media) => {
	const { client, did } = requireSession();
	const { lists, items } = await loadListData(client, did);
	const selectedUris = new Set(
		items.filter((item) => isMediaItem(item, media)).map((item) => item.value.listUri)
	);

	return {
		lists: lists.map((list) => ({
			uri: list.uri,
			name: list.name,
			selected: selectedUris.has(list.uri)
		}))
	};
});

export const toggleListMembership = command(
	toggleListMembershipSchema,
	async ({ media, listUri, selected }) => {
		const { client, did } = requireSession();
		const { lists, items } = await loadListData(client, did);
		const list = lists.find((candidate) => candidate.uri === listUri);
		if (!list) error(404, 'List not found');

		const matchingItems = items.filter(
			(item) => item.value.listUri === list.uri && isMediaItem(item, media)
		);

		if (selected && matchingItems.length === 0) {
			await createListItem(client, did, list, media, await prepareListItem(client, media));
		} else if (!selected && matchingItems.length > 0) {
			await deleteListItems(client, did, matchingItems);
		}

		return { selected };
	}
);

export const createListWithItem = command(
	createListWithItemSchema,
	async ({ media, name, description }) => {
		const { client, did } = requireSession();
		const prepared = await prepareListItem(client, media);
		const list = await createList(client, did, name, description);
		await createListItem(client, did, list, media, prepared);

		return { uri: list.uri, name: list.name, selected: true };
	}
);

function defaultWatchedListName(
	creativeWorkType: v.InferOutput<typeof mediaIdentitySchema>['creativeWorkType']
) {
	return creativeWorkType === 'movie' ? 'Watched Movies' : 'Watched Shows';
}

function isWatchedList(
	list: StoredList,
	creativeWorkType: v.InferOutput<typeof mediaIdentitySchema>['creativeWorkType']
) {
	return list.listType === 'watched' || list.name === defaultWatchedListName(creativeWorkType);
}

export const loadWatchedStatus = command(mediaIdentitySchema, async (media) => {
	const { client, did } = requireSession();
	const { lists, items } = await loadListData(client, did);
	const watchedListUris = new Set(
		lists.filter((list) => isWatchedList(list, media.creativeWorkType)).map((list) => list.uri)
	);

	return {
		watched: items.some(
			(item) =>
				watchedListUris.has(item.value.listUri as CanonicalResourceUri) && isMediaItem(item, media)
		)
	};
});

export const setWatchedStatus = command(setWatchedSchema, async ({ media, watched }) => {
	const { client, did } = requireSession();
	const { lists, items } = await loadListData(client, did);
	const watchedLists = lists.filter((list) => isWatchedList(list, media.creativeWorkType));
	const watchedListUris = new Set(watchedLists.map((list) => list.uri));
	const matchingItems = items.filter(
		(item) =>
			watchedListUris.has(item.value.listUri as CanonicalResourceUri) && isMediaItem(item, media)
	);

	if (watched && matchingItems.length === 0) {
		const list =
			watchedLists.find((candidate) => candidate.listType === 'watched') ??
			watchedLists[0] ??
			(await createList(
				client,
				did,
				defaultWatchedListName(media.creativeWorkType),
				'',
				'watched'
			));
		await createListItem(client, did, list, media, await prepareListItem(client, media));
	} else if (!watched && matchingItems.length > 0) {
		await deleteListItems(client, did, matchingItems);
	}

	return { watched };
});
