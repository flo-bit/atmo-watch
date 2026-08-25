import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMediaRatingSummary, getMediaReviewsPage } from '$lib/reviews.server';
import { getMediaPage, TMDBError } from '$lib/tmdb.server';
import { parseMediaRouteKind, parseTmdbId } from '$lib/utils';
import { getMediaSubmittedVideos } from '$lib/videos.server';

function normalizeRegion(value: string | null | undefined) {
	const region = value?.trim().toUpperCase();
	return region && /^[A-Z]{2}$/.test(region) && region !== 'XX' ? region : null;
}

function getStreamingRegion(url: URL, request: Request) {
	const requested = normalizeRegion(url.searchParams.get('region'));
	if (requested) return requested;

	const cloudflareRequest = request as Request & { cf?: { country?: string } };
	const detected =
		normalizeRegion(cloudflareRequest.cf?.country) ??
		normalizeRegion(request.headers.get('cf-ipcountry'));
	if (detected) return detected;

	for (const language of (request.headers.get('accept-language') ?? '').split(',')) {
		try {
			const locale = new Intl.Locale(language.split(';')[0].trim().replace('_', '-'));
			const region = normalizeRegion(locale.region);
			if (region) return region;
		} catch {
			// Ignore malformed language tags.
		}
	}

	return null;
}

const REVIEW_PAGE_SIZE = 12;

export const load: PageServerLoad = async ({ locals, params, request, url }) => {
	const tmdbId = parseTmdbId(params.id);
	const creativeWorkType = parseMediaRouteKind(params.kind);

	if (!tmdbId || !creativeWorkType) {
		error(404, 'Not found');
	}

	try {
		const [mediaPage, reviewPage, ratingSummary, submittedVideos] = await Promise.all([
			getMediaPage(tmdbId, creativeWorkType, getStreamingRegion(url, request)),
			getMediaReviewsPage({
				tmdbId,
				creativeWorkType,
				limit: REVIEW_PAGE_SIZE,
				viewerDid: locals.did
			}).catch((cause) => {
				console.error('Could not load reviews from Contrail', cause);
				return { reviews: [], cursor: null };
			}),
			getMediaRatingSummary(tmdbId, creativeWorkType).catch((cause) => {
				console.error('Could not load rating summary from Contrail', cause);
				return { score: null, count: 0 };
			}),
			getMediaSubmittedVideos(tmdbId, creativeWorkType).catch((cause) => {
				console.error('Could not load submitted videos from Contrail', cause);
				return [];
			})
		]);

		return {
			...mediaPage,
			videos: [...mediaPage.videos, ...submittedVideos],
			reviews: reviewPage.reviews,
			reviewCursor: reviewPage.cursor,
			ratingSummary,
			today: new Date().toISOString().slice(0, 10)
		};
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) {
			error(404, 'Not found');
		}

		throw cause;
	}
};
