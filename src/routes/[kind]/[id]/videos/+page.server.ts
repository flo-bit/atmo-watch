import { error } from '@sveltejs/kit';
import { getMediaVideosPage, TMDBError } from '$lib/tmdb.server';
import type { MediaVideo } from '$lib/types';
import { parseMediaRouteKind, parseTmdbId } from '$lib/utils';
import { getMediaSubmittedVideos } from '$lib/videos.server';
import type { PageServerLoad } from './$types';

function parseSeason(value: string | null) {
	if (value === null || !/^\d{1,3}$/.test(value)) return null;
	const season = Number(value);
	return Number.isSafeInteger(season) ? season : null;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const tmdbId = parseTmdbId(params.id);
	const creativeWorkType = parseMediaRouteKind(params.kind);
	if (!tmdbId || !creativeWorkType) error(404, 'Not found');

	try {
		const [mediaPage, submittedVideos] = await Promise.all([
			getMediaVideosPage(tmdbId, creativeWorkType),
			getMediaSubmittedVideos(tmdbId, creativeWorkType).catch((cause) => {
				console.error('Could not load submitted videos from Contrail', cause);
				return [];
			})
		]);
		const officialVideos: MediaVideo[] = mediaPage.videos.map((video) => ({
			...video,
			context: {
				creativeWorkType,
				tmdbId,
				title: mediaPage.item.title
			}
		}));
		const seenYouTubeIds = new Set<string>();
		const videos = [...submittedVideos, ...officialVideos].filter((video) => {
			if (seenYouTubeIds.has(video.key)) return false;
			seenYouTubeIds.add(video.key);
			return true;
		});

		return {
			item: mediaPage.item,
			seasons: mediaPage.seasons,
			videos,
			initialSeason: parseSeason(url.searchParams.get('season'))
		};
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) error(404, 'Not found');
		throw cause;
	}
};
