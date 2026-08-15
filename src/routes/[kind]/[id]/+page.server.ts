import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMediaReviews } from '$lib/reviews.server';
import { getMediaPage, TMDBError } from '$lib/tmdb.server';
import { isMediaKind, parseTmdbId } from '$lib/utils';

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
			const region = normalizeRegion(locale.region ?? locale.maximize().region);
			if (region) return region;
		} catch {
			// Ignore malformed language tags.
		}
	}

	return 'US';
}

export const load: PageServerLoad = async ({ params, request, url }) => {
	const id = parseTmdbId(params.id);
	const kind = params.kind;

	if (!id || !isMediaKind(kind)) {
		error(404, 'Not found');
	}

	try {
		const [mediaPage, reviews] = await Promise.all([
			getMediaPage(id, kind, getStreamingRegion(url, request)),
			getMediaReviews(id, kind).catch((cause) => {
				console.error('Could not load reviews from Contrail', cause);
				return [];
			})
		]);

		return { ...mediaPage, reviews };
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) {
			error(404, 'Not found');
		}

		throw cause;
	}
};
