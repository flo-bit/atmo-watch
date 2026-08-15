import { contrail } from '$lib/contrail';
import type * as ReviewListRecords from '$lib/contrail/types/types/watch/atmo/review/listRecords';
import type { MediaKind, Review } from '$lib/types';

function getMediaKind(creativeWorkType: string): MediaKind | undefined {
	if (creativeWorkType === 'movie') return 'movie';
	if (creativeWorkType === 'tv_show') return 'tv';
	return undefined;
}

export function toReview(
	record: ReviewListRecords.Record,
	handle: string = record.did
): Review | undefined {
	const mediaType = getMediaKind(record.value.creativeWorkType);
	const tmdbId = record.value.identifiers.tmdbId;
	if (!mediaType || !tmdbId || !record.value.title) return undefined;

	const id = Number(tmdbId);
	if (!Number.isSafeInteger(id) || id <= 0) return undefined;

	return {
		uri: record.uri,
		author: {
			did: record.did,
			handle
		},
		item: {
			id,
			media_type: mediaType,
			title: record.value.title,
			poster_path: record.value.posterUrl ?? null
		},
		rating: record.value.rating,
		text: record.value.text ?? ''
	};
}

export async function getMediaReviews(id: number, kind: MediaKind): Promise<Review[]> {
	const creativeWorkType = kind === 'movie' ? 'movie' : 'tv_show';
	const params = {
		creativeWorkType,
		identifiersTmdbId: String(id),
		limit: 200,
		profiles: true
	};
	const response = await contrail.get('watch.atmo.review.listRecords', { params });

	if (!response.ok) {
		throw new Error(`Could not load reviews from Contrail (${response.status})`);
	}

	const handles = new Map(
		(response.data.profiles ?? []).map((profile) => [profile.did, profile.handle ?? profile.did])
	);

	return response.data.records.flatMap((record) => {
		const review = toReview(record, handles.get(record.did));
		return review?.item.id === id && review.item.media_type === kind ? [review] : [];
	});
}
