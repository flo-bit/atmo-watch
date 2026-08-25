import { getAtprotoCdnImageUrl } from '$lib/atproto/images';
import { contrail } from '$lib/contrail-client.server';
import type * as ListRecords from '$lib/contrail/types/types/watch/atmo/list/listRecords';
import type * as ListItemRecords from '$lib/contrail/types/types/watch/atmo/listItem/listRecords';
import type { ActorSummary, MediaImage, MediaListModel, MediaSummary } from '$lib/types';
import type { ActorIdentifier, ResourceUri } from '@atcute/lexicons';

type ListItemRecord = Pick<ListItemRecords.Record, 'uri' | 'did' | 'value'>;
type ListRecord = Pick<ListRecords.Record, 'uri' | 'did' | 'rkey' | 'value'> & {
	items?: ListItemRecord[];
	itemsCount?: number;
};

function getPoster(record: ListItemRecord): MediaImage | null {
	if (record.value.poster) {
		const url = getAtprotoCdnImageUrl({
			did: record.did,
			blob: record.value.poster,
			preset: 'feed_thumbnail'
		});
		if (url) return { source: 'remote', url };
	}

	return record.value.posterUrl ? { source: 'remote', url: record.value.posterUrl } : null;
}

function toMediaSummary(record: ListItemRecord): MediaSummary | undefined {
	const creativeWorkType = record.value.creativeWorkType;
	if (creativeWorkType !== 'movie' && creativeWorkType !== 'tv_show') return undefined;
	if (!record.value.title || !record.value.identifiers.tmdbId) return undefined;

	const tmdbId = Number(record.value.identifiers.tmdbId);
	if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return undefined;

	return {
		creativeWorkType,
		tmdbId,
		title: record.value.title,
		poster: getPoster(record)
	};
}

function orderListItems(records: ListItemRecord[], itemOrder: string[] | undefined) {
	const explicitOrder = new Map((itemOrder ?? []).map((uri, index) => [uri, index]));

	return [...records].sort((left, right) => {
		const leftOrder = explicitOrder.get(left.uri);
		const rightOrder = explicitOrder.get(right.uri);
		if (leftOrder !== undefined || rightOrder !== undefined) {
			return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
		}

		const leftPosition = left.value.position;
		const rightPosition = right.value.position;
		if (leftPosition !== undefined || rightPosition !== undefined) {
			return (leftPosition ?? Number.MAX_SAFE_INTEGER) - (rightPosition ?? Number.MAX_SAFE_INTEGER);
		}

		return Date.parse(right.value.addedAt) - Date.parse(left.value.addedAt);
	});
}

function buildList(
	record: ListRecord,
	records: ListItemRecord[],
	author: ActorSummary,
	itemCount = records.length
): { list: MediaListModel; items: MediaSummary[] } {
	const items = orderListItems(records, record.value.itemOrder).flatMap((item) => {
		const media = toMediaSummary(item);
		return media ? [media] : [];
	});

	return {
		list: {
			uri: record.uri,
			rkey: record.rkey,
			author,
			name: record.value.name,
			description: record.value.description?.trim() ?? '',
			listType: record.value.listType,
			ordered: record.value.ordered ?? false,
			createdAt: record.value.createdAt,
			itemCount: Math.max(itemCount, items.length),
			previewItems: items.slice(0, 10)
		},
		items
	};
}

async function getActorLists(actor: string) {
	const records: ListRecords.Record[] = [];
	let cursor: string | undefined;

	do {
		const response = await contrail.get('watch.atmo.list.listRecords', {
			params: {
				actor: actor as ActorIdentifier,
				cursor,
				limit: 200,
				order: 'desc',
				itemsCountMin: 1,
				hydrateItems: 10
			}
		});
		if (!response.ok) throw new Error(`Could not load lists from Contrail (${response.status})`);
		records.push(...response.data.records);
		cursor = response.data.cursor;
	} while (cursor);

	return records;
}

async function getListItems(listUri: ResourceUri) {
	const records: ListItemRecord[] = [];
	let cursor: string | undefined;

	do {
		const response = await contrail.get('watch.atmo.listItem.listRecords', {
			params: { listUri, cursor, limit: 200 }
		});
		if (!response.ok) {
			throw new Error(`Could not load list items from Contrail (${response.status})`);
		}
		records.push(...response.data.records);
		cursor = response.data.cursor;
	} while (cursor);

	return records;
}

export async function getProfileMediaLists(author: ActorSummary): Promise<MediaListModel[]> {
	const lists = await getActorLists(author.did);
	return lists.map(
		(record) => buildList(record, record.items ?? [], author, record.itemsCount ?? 0).list
	);
}

export async function getMediaListPage({
	uri,
	author,
	page,
	pageSize = 60
}: {
	uri: ResourceUri;
	author: ActorSummary;
	page: number;
	pageSize?: number;
}) {
	const [listResponse, listItems] = await Promise.all([
		contrail.get('watch.atmo.list.getRecord', { params: { uri } }),
		getListItems(uri)
	]);
	if (!listResponse.ok) return { response: listResponse } as const;

	const { list, items } = buildList(listResponse.data, listItems, author);
	const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
	const currentPage = Math.min(page, totalPages);
	const start = (currentPage - 1) * pageSize;

	return {
		response: listResponse,
		list,
		items: items.slice(start, start + pageSize),
		currentPage,
		totalPages
	} as const;
}
