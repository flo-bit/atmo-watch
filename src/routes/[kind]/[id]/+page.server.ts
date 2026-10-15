import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMediaCommunity } from '$lib/community.server';
import { getMediaPage, TMDBError } from '$lib/tmdb.server';
import { mediaCanonicalPath, parseMediaRouteKind, parseTmdbId } from '$lib/utils';

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

export const load: PageServerLoad = async ({ locals, params, request, setHeaders, url }) => {
	const tmdbId = parseTmdbId(params.id);
	const creativeWorkType = parseMediaRouteKind(params.kind);

	if (!tmdbId || !creativeWorkType) {
		error(404, 'Not found');
	}

	try {
		// Resolve the catalog entry first: nonexistent IDs must not trigger community work.
		const mediaPage = await getMediaPage(
			tmdbId,
			creativeWorkType,
			getStreamingRegion(url, request)
		);
		const { submittedVideos, ...community } = await getMediaCommunity({
			tmdbId,
			creativeWorkType,
			viewerDid: locals.did
		});
		if (community.hasCommunityContent === false) {
			setHeaders({ 'X-Robots-Tag': 'noindex, nofollow' });
		}

		return {
			...mediaPage,
			videos: [...mediaPage.videos, ...submittedVideos],
			...community,
			canonicalUrl: new URL(mediaCanonicalPath(mediaPage.item), url.origin).href,
			today: new Date().toISOString().slice(0, 10)
		};
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) {
			error(404, 'Not found');
		}

		throw cause;
	}
};
