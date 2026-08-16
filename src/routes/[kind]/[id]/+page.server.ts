import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMediaReviews } from '$lib/reviews.server';
import { getMediaPage, TMDBError } from '$lib/tmdb.server';
import { parseMediaRouteKind, parseTmdbId } from '$lib/utils';

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

export const load: PageServerLoad = async ({ params, request, url }) => {
	const tmdbId = parseTmdbId(params.id);
	const creativeWorkType = parseMediaRouteKind(params.kind);

	if (!tmdbId || !creativeWorkType) {
		error(404, 'Not found');
	}

	try {
		const [mediaPage, reviews] = await Promise.all([
			getMediaPage(tmdbId, creativeWorkType, getStreamingRegion(url, request)),
			getMediaReviews(tmdbId, creativeWorkType).catch((cause) => {
				console.error('Could not load reviews from Contrail', cause);
				return [];
			})
		]);

		return { ...mediaPage, reviews, today: new Date().toISOString().slice(0, 10) };
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) {
			error(404, 'Not found');
		}

		throw cause;
	}
};
