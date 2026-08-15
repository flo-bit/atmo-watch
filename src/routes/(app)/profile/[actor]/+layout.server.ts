import { contrail } from '$lib/contrail';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const actor = params.actor;

	const reviews = await contrail.get('watch.atmo.review.listRecords', {
		params: {
			actor,
			profiles: true
		}
	});

	const profile = await contrail.get('watch.atmo.getProfile', {
		params: {
			actor
		}
	});

	if (!reviews.ok) return;

	const data = reviews.data.records;
	console.log(data);

	// export type Item = {
	//     id: number;
	//     ref: TmdbRef;
	//     media_type: MediaKind;
	//     title: string;
	//     poster_path: string | null;
	//     backdrop_path: string | null;
	//     overview: string;
	//     order?: number;
	// };

	const items = data
		.filter(
			(review) =>
				(review.value.creativeWorkType === 'tv_show' ||
					review.value.creativeWorkType === 'movie') &&
				review.value.identifiers.tmdbId &&
				review.value.posterUrl &&
				review.value.title
		)
		.map((review) => {
			const type = review.value.creativeWorkType == 'tv_show' ? 'tv' : 'movie';
			const id = (type == 'movie' ? `tmdb:m-` : `tmdb:t-`) + review.value.identifiers.tmdbId;

			return {
				id: review.value.identifiers.tmdbId,
				ref: id,
				media_type: type,
				title: review.value.title ?? 'Untitled',
				poster_path: review.value.posterUrl
			};
		});
	console.log(reviews.data.profiles);

	if (!profile.ok) return;

	return { items, profile: profile.data };
};
