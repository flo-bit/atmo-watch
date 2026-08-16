import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getTvSeasonPage, TMDBError } from '$lib/tmdb.server';
import { parseMediaRouteKind, parseTmdbId } from '$lib/utils';

function parseSeasonNumber(value: string) {
	if (!/^\d{1,3}$/.test(value)) return null;
	const seasonNumber = Number(value);
	return Number.isSafeInteger(seasonNumber) ? seasonNumber : null;
}

export const load: PageServerLoad = async ({ params }) => {
	const tmdbId = parseTmdbId(params.id);
	const creativeWorkType = parseMediaRouteKind(params.kind);
	const seasonNumber = parseSeasonNumber(params.season);

	if (!tmdbId || creativeWorkType !== 'tv_show' || seasonNumber === null) {
		error(404, 'Not found');
	}

	try {
		return {
			...(await getTvSeasonPage(tmdbId, seasonNumber)),
			today: new Date().toISOString().slice(0, 10)
		};
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) {
			error(404, 'Not found');
		}
		throw cause;
	}
};
