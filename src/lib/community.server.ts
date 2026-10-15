import type { Did } from '@atcute/lexicons';
import { getCommunityPresence, hasCommunityContent } from '$lib/community-presence.server';
import { getMediaRatingSummary, getMediaReviewsPage } from '$lib/reviews.server';
import type { SupportedCreativeWorkType } from '$lib/types';
import { getMediaSubmittedVideos } from '$lib/videos.server';

export async function getMediaCommunity({
	tmdbId,
	creativeWorkType,
	viewerDid
}: {
	tmdbId: number;
	creativeWorkType: SupportedCreativeWorkType;
	viewerDid?: Did | null;
}) {
	const presence = viewerDid ? null : await getCommunityPresence(tmdbId, creativeWorkType);
	let failed = false;
	const [reviewPage, ratingSummary, submittedVideos] = await Promise.all([
		presence?.hasReviews === false
			? { reviews: [], cursor: null }
			: getMediaReviewsPage({ tmdbId, creativeWorkType, limit: 12, viewerDid }).catch((cause) => {
					failed = true;
					console.error('Could not load reviews from Contrail', cause);
					return { reviews: [], cursor: null };
				}),
		presence?.hasReviews === false
			? { score: null, count: 0 }
			: getMediaRatingSummary(tmdbId, creativeWorkType, Boolean(viewerDid)).catch((cause) => {
					failed = true;
					console.error('Could not load rating summary from Contrail', cause);
					return { score: null, count: 0 };
				}),
		getMediaSubmittedVideos(tmdbId, creativeWorkType, presence, Boolean(viewerDid)).catch(
			(cause) => {
				failed = true;
				console.error('Could not load submitted videos from Contrail', cause);
				return [];
			}
		)
	]);

	const observedContent =
		reviewPage.reviews.length > 0 || ratingSummary.count > 0 || submittedVideos.length > 0;
	return {
		reviews: reviewPage.reviews,
		reviewCursor: reviewPage.cursor,
		ratingSummary,
		submittedVideos,
		// Only a successful presence check (or complete authenticated reads) may
		// prove absence. Transient failures must not de-index an existing title.
		hasCommunityContent: observedContent
			? true
			: presence
				? hasCommunityContent(presence)
				: viewerDid && !failed
					? false
					: null
	};
}
