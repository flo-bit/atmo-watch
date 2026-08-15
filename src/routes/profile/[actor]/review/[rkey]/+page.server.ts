import { error } from '@sveltejs/kit';
import type { ResourceUri } from '@atcute/lexicons';
import { isRecordKey } from '@atcute/lexicons/syntax';
import { contrail } from '$lib/contrail';
import { getReviewInteractions, toReview } from '$lib/reviews.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!isRecordKey(params.rkey)) error(404, 'Review not found');

	const { profile } = await parent();
	const reviewUri = `at://${profile.did}/social.popfeed.feed.review/${params.rkey}` as ResourceUri;
	const reviewResponse = await contrail.get('watch.atmo.review.getRecord', {
		params: { uri: reviewUri, profiles: true }
	});

	if (!reviewResponse.ok) {
		if (reviewResponse.status === 400 || reviewResponse.status === 404) {
			error(404, 'Review not found');
		}
		error(502, 'Could not load review');
	}

	const review = toReview(reviewResponse.data, profile.handle);
	if (!review) error(404, 'Review not found');

	const interactions = await getReviewInteractions(reviewUri, locals.did).catch((cause) => {
		console.error('Could not load review interactions from Contrail', cause);
		return {
			likeCount: 0,
			commentCount: 0,
			viewerLikeUri: null,
			comments: []
		};
	});

	return {
		review: {
			...review,
			author: {
				...review.author,
				displayName: profile.displayName,
				avatarUrl: profile.avatarUrl
			},
			createdAt: reviewResponse.data.value.createdAt
		},
		...interactions
	};
};
