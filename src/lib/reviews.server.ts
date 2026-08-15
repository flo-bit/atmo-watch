import { getAtprotoCdnImageUrl } from '$lib/atproto/images';
import { contrail } from '$lib/contrail';
import type * as ReviewListRecords from '$lib/contrail/types/types/watch/atmo/review/listRecords';
import type { MediaImage, ReviewCardModel, SupportedCreativeWorkType } from '$lib/types';

function getCreativeWorkType(value: string): SupportedCreativeWorkType | undefined {
	if (value === 'movie' || value === 'tv_show') return value;
	return undefined;
}

function getPoster(record: ReviewListRecords.Record): MediaImage | null {
	if (record.value.poster) {
		return {
			source: 'remote',
			url: getAtprotoCdnImageUrl({
				did: record.did,
				blob: record.value.poster,
				preset: 'feed_thumbnail'
			})
		};
	}

	return record.value.posterUrl ? { source: 'remote', url: record.value.posterUrl } : null;
}

export function toReview(
	record: ReviewListRecords.Record,
	handle: string = record.did
): ReviewCardModel | undefined {
	const creativeWorkType = getCreativeWorkType(record.value.creativeWorkType);
	const rawTmdbId = record.value.identifiers.tmdbId;
	if (!creativeWorkType || !rawTmdbId || !record.value.title) return undefined;

	const tmdbId = Number(rawTmdbId);
	if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return undefined;

	return {
		uri: record.uri,
		author: {
			did: record.did,
			handle
		},
		media: {
			creativeWorkType,
			tmdbId,
			title: record.value.title,
			poster: getPoster(record)
		},
		rating: record.value.rating,
		text: record.value.text ?? ''
	};
}

export async function getMediaReviews(
	tmdbId: number,
	creativeWorkType: SupportedCreativeWorkType
): Promise<ReviewCardModel[]> {
	const params = {
		creativeWorkType,
		identifiersTmdbId: String(tmdbId),
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
		return review?.media.tmdbId === tmdbId && review.media.creativeWorkType === creativeWorkType
			? [review]
			: [];
	});
}
