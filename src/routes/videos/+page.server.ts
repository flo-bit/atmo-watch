import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRandomSubmittedVideos } from '$lib/videos.server';

export const load: PageServerLoad = async () => {
	try {
		return { videos: await getRandomSubmittedVideos() };
	} catch (cause) {
		console.error('Could not load random videos from Contrail', cause);
		error(502, 'Could not load videos');
	}
};
