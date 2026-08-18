import { error } from '@sveltejs/kit';
import { contrail } from '$lib/contrail-active';
import { getProfileMediaLists } from '$lib/lists.server';
import { getViewerReviewLikes, toReview } from '$lib/reviews.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { profile } = await parent();
	const [response, viewerLikes, lists] = await Promise.all([
		contrail.get('watch.atmo.review.listRecords', {
			params: { actor: profile.did, limit: 200, order: 'desc' }
		}),
		getViewerReviewLikes(locals.did).catch((cause) => {
			console.error('Could not load viewer review likes from Contrail', cause);
			return new Map<string, string>();
		}),
		getProfileMediaLists(profile).catch((cause) => {
			console.error('Could not load profile lists from Contrail', cause);
			return [];
		})
	]);

	if (!response.ok) error(502, 'Could not load reviews');

	const reviews = response.data.records.flatMap((record) => {
		const review = toReview(record, profile.handle);
		return review
			? [
					{
						...review,
						author: {
							...review.author,
							displayName: profile.displayName,
							avatarUrl: profile.avatarUrl
						},
						viewerLikeUri: viewerLikes.get(review.uri) ?? null
					}
				]
			: [];
	});

	return { reviews, lists };
};
