import { error } from '@sveltejs/kit';
import { contrail } from '$lib/contrail';
import { toReview } from '$lib/reviews.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { profile } = await parent();
	const response = await contrail.get('watch.atmo.review.listRecords', {
		params: { actor: profile.did }
	});

	if (!response.ok) error(502, 'Could not load reviews');

	return {
		reviews: response.data.records.flatMap((record) => {
			const review = toReview(record, profile.handle);
			return review ? [review] : [];
		})
	};
};
