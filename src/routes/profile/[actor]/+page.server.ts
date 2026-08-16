import { error } from '@sveltejs/kit';
import { contrail } from '$lib/contrail';
import { getProfileMediaLists } from '$lib/lists.server';
import { toReview } from '$lib/reviews.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { profile } = await parent();
	const response = await contrail.get('watch.atmo.review.listRecords', {
		params: { actor: profile.did }
	});

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
						}
					}
				]
			: [];
	});

	const lists = await getProfileMediaLists(profile).catch((cause) => {
		console.error('Could not load profile lists from Contrail', cause);
		return [];
	});

	return { reviews, lists };
};
