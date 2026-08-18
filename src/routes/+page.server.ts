import type { PageServerLoad } from './$types';
import { getRecentReviewsPage } from '$lib/reviews.server';
import { getHomePage } from '$lib/tmdb.server';

export const load: PageServerLoad = async ({ locals }) => {
	const [homePage, recentReviews] = await Promise.all([
		getHomePage(),
		getRecentReviewsPage({ limit: 5, viewerDid: locals.did }).catch((cause) => {
			console.error('Could not load recent reviews from Contrail', cause);
			return { reviews: [], cursor: null };
		})
	]);

	return { ...homePage, recentReviews };
};
