import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getTvSeasonPage, TMDBError } from '$lib/tmdb.server';
import { getCommunityPresence } from '$lib/community-presence.server';
import { parseMediaRouteKind, parseTmdbId } from '$lib/utils';
import { getSubmittedVideos } from '$lib/videos.server';

function parseSeasonNumber(value: string) {
	if (!/^\d{1,3}$/.test(value)) return null;
	const seasonNumber = Number(value);
	return Number.isSafeInteger(seasonNumber) ? seasonNumber : null;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const tmdbId = parseTmdbId(params.id);
	const creativeWorkType = parseMediaRouteKind(params.kind);
	const seasonNumber = parseSeasonNumber(params.season);

	if (!tmdbId || creativeWorkType !== 'tv_show' || seasonNumber === null) {
		error(404, 'Not found');
	}

	try {
		const seasonPage = await getTvSeasonPage(tmdbId, seasonNumber);
		const presence = locals.did ? null : await getCommunityPresence(tmdbId, creativeWorkType);
		const submittedVideos =
			presence?.hasDescendantVideos === false
				? []
				: await getSubmittedVideos(
						{ tmdbTvSeriesId: tmdbId, seasonNumber },
						Boolean(locals.did)
					).catch((cause) => {
						console.error('Could not load submitted season videos from Contrail', cause);
						return [];
					});
		return {
			...seasonPage,
			submittedVideos,
			today: new Date().toISOString().slice(0, 10)
		};
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) {
			error(404, 'Not found');
		}
		throw cause;
	}
};
