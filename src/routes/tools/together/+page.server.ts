import { MIX_MAX_RESULTS, rankMix, type MixSource } from '$lib/mix';
import { getActorProfile } from '$lib/profiles.server';
import {
	chooseSeeds,
	parseTogetherActors,
	rankWatchlists,
	TOGETHER_MIN_WATCHLIST
} from '$lib/together';
import { getMixSources } from '$lib/tmdb.server';
import type { MediaSummary } from '$lib/types';
import { mediaKey } from '$lib/utils';
import { getActorLibrary } from '$lib/watched.server';
import type { PageServerLoad } from './$types';

type Library = Awaited<ReturnType<typeof getActorLibrary>>;

async function getSuggestions(libraries: Library[], exclude: ReadonlySet<string>) {
	const seeds = chooseSeeds(libraries.map((library) => library.liked));
	const unique = [...new Map(seeds.map((seed) => [mediaKey(seed.pick), seed.pick])).values()];
	const { sources, unavailable } = await getMixSources(unique);
	const byKey = new Map(sources.map((source) => [mediaKey(source.pick), source]));
	const owned = seeds.flatMap(({ owner, pick }): MixSource[] => {
		const source = byKey.get(mediaKey(pick));
		return source ? [{ ...source, owner: String(owner) }] : [];
	});

	return { suggestions: rankMix(owned, exclude), unavailable };
}

export const load: PageServerLoad = async ({ url }) => {
	const requested = parseTogetherActors(url.searchParams);
	const profiles = await Promise.allSettled(requested.map((actor) => getActorProfile(actor)));
	const missing: string[] = [];
	let unavailable = false;
	const found = new Map<string, NonNullable<Awaited<ReturnType<typeof getActorProfile>>>>();
	profiles.forEach((result, index) => {
		if (result.status === 'rejected') {
			unavailable = true;
			console.error(`Could not load profile for ${requested[index]}`, result.reason);
		} else if (!result.value) missing.push(requested[index]);
		// Two names for one account count once.
		else if (!found.has(result.value.did)) found.set(result.value.did, result.value);
	});

	const profilesFound = [...found.values()];
	const libraries = await Promise.all(profilesFound.map((profile) => getActorLibrary(profile.did)));
	const people = profilesFound.map(({ did, handle, displayName, avatarUrl }, index) => ({
		did,
		handle,
		displayName,
		avatarUrl,
		empty: libraries[index].watched.size === 0 && libraries[index].watchlist.length === 0
	}));

	let watchlist: MediaSummary[] = [];
	let suggestions: MediaSummary[] = [];
	if (people.length >= 2) {
		const watched = new Set(libraries.flatMap((library) => [...library.watched]));
		watchlist = rankWatchlists(
			libraries.map((library) => library.watchlist),
			watched
		).slice(0, MIX_MAX_RESULTS);

		if (watchlist.length < TOGETHER_MIN_WATCHLIST) {
			const result = await getSuggestions(
				libraries,
				new Set([...watched, ...watchlist.map(mediaKey)])
			);
			suggestions = result.suggestions;
			unavailable ||= result.unavailable;
		}
	}

	return { people, missing, watchlist, suggestions, unavailable };
};
