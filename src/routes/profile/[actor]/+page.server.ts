import { getProfileMediaLists } from '$lib/lists.server';
import { getProfileReviewsPage } from '$lib/reviews.server';
import type { PageServerLoad } from './$types';

const REVIEW_PAGE_SIZE = 30;

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { profile } = await parent();
	const [reviewPage, lists] = await Promise.all([
		getProfileReviewsPage({
			actor: profile.did,
			limit: REVIEW_PAGE_SIZE,
			viewerDid: locals.did
		}),
		getProfileMediaLists(profile).catch((cause) => {
			console.error('Could not load profile lists from Contrail', cause);
			return [];
		})
	]);

	return { reviews: reviewPage.reviews, reviewCursor: reviewPage.cursor, lists };
};
