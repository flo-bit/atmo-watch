import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRecentSubmittedVideosPage } from '$lib/videos.server';

export const load: PageServerLoad = async () => {
	try {
		return { recentVideos: await getRecentSubmittedVideosPage() };
	} catch (cause) {
		console.error('Could not load recent videos from Contrail', cause);
		error(502, 'Could not load recently submitted videos');
	}
};
