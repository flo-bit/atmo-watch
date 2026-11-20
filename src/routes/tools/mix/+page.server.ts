import { parseMixPicks, rankMix } from '$lib/mix';
import { getMixSources } from '$lib/tmdb.server';
import { getActorLibrary } from '$lib/watched.server';
import type { PageServerLoad } from './$types';

const MAX_RATED_SUGGESTIONS = 40;

export const load: PageServerLoad = async ({ url, locals }) => {
	const requested = parseMixPicks(url.searchParams);
	const [{ sources, unavailable }, library] = await Promise.all([
		getMixSources(requested),
		locals.did ? getActorLibrary(locals.did) : null
	]);

	return {
		picks: sources.map((source) => source.pick),
		results: rankMix(sources, library?.watched),
		// The viewer's own ratings, offered as quick picks.
		rated: library?.rated.slice(0, MAX_RATED_SUGGESTIONS) ?? [],
		unavailable
	};
};
