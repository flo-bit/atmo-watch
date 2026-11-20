import type { Did } from '@atcute/lexicons';
import { contrail } from '$lib/contrail-client.server';
import {
	getActorLists,
	getListItems,
	isWatchedList,
	isWatchlist,
	listItemToMedia
} from '$lib/lists.server';
import { toReview } from '$lib/reviews.server';
import type { MediaSummary } from '$lib/types';
import { mediaKey } from '$lib/utils';

const MAX_REVIEW_PAGES = 25;
/** Ratings are out of 10; from here up a title counts as one the person liked. */
const LIKED_RATING = 7;
const WATCHED_LIST_TYPES = new Set(['watched_movies', 'watched_tv_shows']);

type RatedMedia = { media: MediaSummary; rating: number; createdAt: string };

function toKey(creativeWorkType: string, rawTmdbId: string | undefined) {
	if (creativeWorkType !== 'movie' && creativeWorkType !== 'tv_show') return undefined;
	const tmdbId = Number(rawTmdbId);
	return Number.isSafeInteger(tmdbId) && tmdbId > 0
		? mediaKey({ creativeWorkType, tmdbId })
		: undefined;
}

function unique(items: MediaSummary[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = mediaKey(item);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

async function getListMedia(did: Did) {
	const lists = await getActorLists(did);
	const load = async (selected: typeof lists) =>
		(await Promise.all(selected.map((list) => getListItems(list.uri)))).flat();

	const [watched, watchlist] = await Promise.all([
		load(
			lists.filter(
				(list) =>
					WATCHED_LIST_TYPES.has(list.value.listType ?? '') ||
					(['movie', 'tv_show'] as const).some((type) => isWatchedList(list.value, type))
			)
		),
		load(lists.filter((list) => isWatchlist(list.value)))
	]);
	return {
		watched: watched.flatMap((item) => {
			const key = toKey(item.value.creativeWorkType, item.value.identifiers.tmdbId);
			return key ? [key] : [];
		}),
		watchlist: unique(
			watchlist.flatMap((item) => {
				const media = listItemToMedia(item);
				return media?.poster ? [media] : [];
			})
		)
	};
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

	// Best rating first, newest first within a rating.
	return rated.sort(
		(left, right) => right.rating - left.rating || right.createdAt.localeCompare(left.createdAt)
	);
}

/**
 * A person's public watch history, read from the index:
 * - `watched`: `mediaKey` values from watched lists and ratings
 * - `rated`: every rated title, favourites first
 * - `liked`: the rated titles they scored well
 * - `watchlist`: titles they saved to watch, minus anything already watched
 *
 * A failed lookup leaves its part empty rather than failing the page.
 */
export async function getActorLibrary(did: Did) {
	const [lists, reviews] = await Promise.allSettled([getListMedia(did), getRatedMedia(did)]);
	for (const result of [lists, reviews]) {
		if (result.status === 'rejected') {
			console.error('Could not load watched titles from Contrail', result.reason);
		}
	}

	const ratings = reviews.status === 'fulfilled' ? reviews.value : [];
	const rated = unique(ratings.map((entry) => entry.media));
	const liked = unique(
		ratings.filter((entry) => entry.rating >= LIKED_RATING).map((entry) => entry.media)
	);
	const listMedia = lists.status === 'fulfilled' ? lists.value : { watched: [], watchlist: [] };
	const watched = new Set([...listMedia.watched, ...rated.map(mediaKey)]);

	return {
		watched,
		rated,
		liked,
		watchlist: listMedia.watchlist.filter((item) => !watched.has(mediaKey(item)))
	};
}
