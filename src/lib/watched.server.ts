import type { Did } from '@atcute/lexicons';
import { contrail } from '$lib/contrail-client.server';
import { getActorLists, getListItems, isWatchedList } from '$lib/lists.server';
import { toReview } from '$lib/reviews.server';
import type { MediaSummary } from '$lib/types';
import { mediaKey } from '$lib/utils';

const MAX_REVIEW_PAGES = 25;

type RatedMedia = { media: MediaSummary; rating: number; createdAt: string };

function toKey(creativeWorkType: string, rawTmdbId: string | undefined) {
	if (creativeWorkType !== 'movie' && creativeWorkType !== 'tv_show') return undefined;
	const tmdbId = Number(rawTmdbId);
	return Number.isSafeInteger(tmdbId) && tmdbId > 0
		? mediaKey({ creativeWorkType, tmdbId })
		: undefined;
}

async function getWatchedListKeys(did: Did) {
	const lists = (await getActorLists(did)).filter((list) =>
		(['movie', 'tv_show'] as const).some((type) => isWatchedList(list.value, type))
	);
	const items = (await Promise.all(lists.map((list) => getListItems(list.uri)))).flat();
	return items.flatMap((item) => {
		const key = toKey(item.value.creativeWorkType, item.value.identifiers.tmdbId);
		return key ? [key] : [];
	});
}

async function getRatedMedia(did: Did) {
	const rated: RatedMedia[] = [];
	let cursor: string | undefined;
	let pages = 0;

	do {
		const response = await contrail.get('watch.atmo.review.listRecords', {
			params: { actor: did, cursor, limit: 200 }
		});
		if (!response.ok) throw new Error(`Could not load reviews from Contrail (${response.status})`);
		for (const record of response.data.records) {
			const review = toReview(record);
			if (review) {
				rated.push({ media: review.media, rating: review.rating, createdAt: review.createdAt });
			}
		}
		cursor = response.data.cursor;
	} while (cursor && ++pages < MAX_REVIEW_PAGES);

	return rated;
}

/** Best rating first, newest first within a rating, one entry per title. */
function orderRated(rated: RatedMedia[]) {
	const seen = new Set<string>();
	return [...rated]
		.sort(
			(left, right) => right.rating - left.rating || right.createdAt.localeCompare(left.createdAt)
		)
		.flatMap(({ media }) => {
			const key = mediaKey(media);
			if (seen.has(key)) return [];
			seen.add(key);
			return [media];
		});
}

/**
 * What the viewer has already seen: `watched` holds `mediaKey` values from
 * watched lists and ratings; `rated` lists the rated titles, favourites first.
 * A failed lookup leaves its part empty rather than failing the page.
 */
export async function getViewerLibrary(did: Did) {
	const [lists, reviews] = await Promise.allSettled([getWatchedListKeys(did), getRatedMedia(did)]);
	for (const result of [lists, reviews]) {
		if (result.status === 'rejected') {
			console.error('Could not load watched titles from Contrail', result.reason);
		}
	}

	const rated = reviews.status === 'fulfilled' ? orderRated(reviews.value) : [];
	return {
		watched: new Set([
			...(lists.status === 'fulfilled' ? lists.value : []),
			...rated.map(mediaKey)
		]),
		rated
	};
}
