import type { ResourceUri } from '@atcute/lexicons';
import { isActorIdentifier, isRecordKey } from '@atcute/lexicons/syntax';
import { error } from '@sveltejs/kit';
import { getMediaHeader } from '$lib/tmdb.server';
import { getSubmittedVideo } from '$lib/videos.server';
import type { PageServerLoad } from './$types';

function parseActor(value: string) {
	if (isActorIdentifier(value)) return value;
	try {
		const decoded = decodeURIComponent(value);
		return isActorIdentifier(decoded) ? decoded : null;
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ params }) => {
	const actor = parseActor(params.actor);
	if (!actor || !isRecordKey(params.rkey)) error(404, 'Video not found');

	const uri = `at://${actor}/watch.atmo.alpha.video/${params.rkey}` as ResourceUri;
	let video;
	try {
		video = await getSubmittedVideo(uri);
	} catch (cause) {
		console.error('Could not load video from Contrail', cause);
		error(502, 'Could not load video');
	}
	if (!video) error(404, 'Video not found');

	const context = video.context;
	const mediaHeader = context
		? await getMediaHeader(
				context.creativeWorkType === 'movie'
					? context.tmdbId
					: (context.tmdbTvSeriesId ?? context.tmdbId),
				context.creativeWorkType === 'movie' ? 'movie' : 'tv_show'
			).catch((cause) => {
				console.error('Could not load video media from TMDB', cause);
				return null;
			})
		: null;

	return { video, mediaHeader };
};
