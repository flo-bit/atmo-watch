import { isActorIdentifier } from '@atcute/lexicons/syntax';
import type { ActorIdentifier } from '@atcute/lexicons';
import { MIX_MAX_PICKS } from './mix';
import type { MediaSummary } from './types';
import { mediaKey } from './utils';

export const TOGETHER_MAX_PEOPLE = 6;
/** Below this many watchlist matches, suggestions from ratings are added. */
export const TOGETHER_MIN_WATCHLIST = 15;

/** A typed handle or DID, tidied up; `undefined` when it cannot be either. */
export function normalizeActor(value: string): ActorIdentifier | undefined {
	const trimmed = value.trim().replace(/^@+/, '');
	const actor = trimmed.startsWith('did:') ? trimmed : trimmed.toLowerCase();
	return isActorIdentifier(actor) ? actor : undefined;
}

/** Reads `?u=alice.example,bob.example`, dropping invalid and repeated entries. */
export function parseTogetherActors(params: URLSearchParams): ActorIdentifier[] {
	const actors = (params.get('u') ?? '').split(',').flatMap((value) => {
		const actor = normalizeActor(value);
		return actor ? [actor] : [];
	});
	return [...new Set(actors)].slice(0, TOGETHER_MAX_PEOPLE);
}

export function togetherSearch(actors: readonly string[]) {
	return actors.length ? `?u=${actors.join(',')}` : '';
}

/**
 * Unwatched titles from everyone's watchlists. Titles more people saved come
 * first; otherwise each list keeps its own order, taking turns between people.
 */
export function rankWatchlists(
	watchlists: readonly (readonly MediaSummary[])[],
	exclude: ReadonlySet<string>
): MediaSummary[] {
	const entries = new Map<string, { item: MediaSummary; count: number; position: number }>();
	watchlists.forEach((watchlist) => {
		watchlist.forEach((item, position) => {
			const key = mediaKey(item);
			if (exclude.has(key)) return;
			const entry = entries.get(key);
			if (entry) entry.count += 1;
			else entries.set(key, { item, count: 1, position });
		});
	});

	return [...entries.values()]
		.sort((left, right) => right.count - left.count || left.position - right.position)
		.map((entry) => entry.item);
}

/**
 * Picks the titles to base suggestions on: everyone's favourites in turn, so
 * each person gets an equal say even when one has rated far more than the rest.
 */
export function chooseSeeds<T extends MediaSummary>(
	favourites: readonly (readonly T[])[],
	limit = MIX_MAX_PICKS
): Array<{ owner: number; pick: T }> {
	const seeds: Array<{ owner: number; pick: T }> = [];
	const longest = Math.max(0, ...favourites.map((list) => list.length));
	for (let round = 0; round < longest && seeds.length < limit; round += 1) {
		favourites.forEach((list, owner) => {
			if (round < list.length && seeds.length < limit) seeds.push({ owner, pick: list[round] });
		});
	}
	return seeds;
}
