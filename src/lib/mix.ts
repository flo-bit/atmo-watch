import type { MediaIdentity, MediaSummary } from './types';
import { mediaKey } from './utils';

export const MIX_MAX_PICKS = 20;
export const MIX_MAX_RESULTS = 60;
export const MIX_TOP_RATED = 15;

export type MixSource = {
	pick: MediaSummary;
	/** TMDB's recommendations for the pick, best first. */
	recommendations: Array<MediaSummary & { voteCount: number }>;
};

function parseIds(value: string | null) {
	return (value ?? '')
		.split(',')
		.filter((id) => /^\d{1,12}$/.test(id))
		.map(Number)
		.filter((id) => id > 0);
}

/** Reads `?m=603,27205&t=1396` (movies, shows), dropping duplicates and anything over the cap. */
export function parseMixPicks(params: URLSearchParams): MediaIdentity[] {
	const picks: MediaIdentity[] = [
		...parseIds(params.get('m')).map((tmdbId) => ({ creativeWorkType: 'movie' as const, tmdbId })),
		...parseIds(params.get('t')).map((tmdbId) => ({
			creativeWorkType: 'tv_show' as const,
			tmdbId
		}))
	];
	const seen = new Set<string>();
	return picks
		.filter((pick) => {
			const key = mediaKey(pick);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.slice(0, MIX_MAX_PICKS);
}

/**
 * Adds the viewer's best-rated titles that are not picked yet: up to
 * `MIX_TOP_RATED` of them, or fewer when that would exceed the pick limit.
 * `rated` must already be ordered best first.
 */
export function addTopRated<T extends MediaIdentity>(
	picks: readonly T[],
	rated: readonly T[]
): T[] {
	const picked = new Set(picks.map(mediaKey));
	const room = Math.max(0, Math.min(MIX_TOP_RATED, MIX_MAX_PICKS - picks.length));
	return [...picks, ...rated.filter((item) => !picked.has(mediaKey(item))).slice(0, room)];
}

export function mixSearch(picks: readonly MediaIdentity[]) {
	const ids = (type: MediaIdentity['creativeWorkType']) =>
		picks.filter((pick) => pick.creativeWorkType === type).map((pick) => pick.tmdbId);
	const parts = [['m', ids('movie')] as const, ['t', ids('tv_show')] as const].flatMap(
		([name, values]) => (values.length ? [`${name}=${values.join(',')}`] : [])
	);
	return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Titles recommended by more picks come first. Ties fall back to how high the
 * title sits in each pick's own list, then to audience size.
 */
export function rankMix(
	sources: readonly MixSource[],
	exclude: ReadonlySet<string> = new Set(),
	limit = MIX_MAX_RESULTS
): MediaSummary[] {
	const picked = new Set(sources.map((source) => mediaKey(source.pick)));
	const candidates = new Map<
		string,
		{ item: MediaSummary; matches: number; weight: number; voteCount: number }
	>();

	for (const { recommendations } of sources) {
		const seen = new Set<string>();
		recommendations.forEach(({ voteCount, ...item }, index) => {
			const key = mediaKey(item);
			if (!item.poster || picked.has(key) || exclude.has(key) || seen.has(key)) return;
			seen.add(key);

			const candidate = candidates.get(key) ?? { item, matches: 0, weight: 0, voteCount };
			candidate.matches += 1;
			candidate.weight += 1 - index / recommendations.length;
			candidates.set(key, candidate);
		});
	}

	return [...candidates.values()]
		.sort(
			(left, right) =>
				right.matches - left.matches ||
				right.weight - left.weight ||
				right.voteCount - left.voteCount
		)
		.slice(0, limit)
		.map((candidate) => candidate.item);
}
