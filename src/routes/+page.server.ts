import type { PageServerLoad } from './$types';
import { getRecentlyReviewedMedia } from '$lib/reviews.server';
import { getHomePage } from '$lib/tmdb.server';

export const load: PageServerLoad = async () => {
	const [homePage, recentlyReviewedInAtmosphere] = await Promise.all([
		getHomePage(),
		getRecentlyReviewedMedia().catch((cause) => {
			console.error('Could not load recently reviewed media from Contrail', cause);
			return [];
		})
	]);

	return { ...homePage, recentlyReviewedInAtmosphere };
};
