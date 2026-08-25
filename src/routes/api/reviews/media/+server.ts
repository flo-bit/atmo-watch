import { json } from '@sveltejs/kit';
import { getMediaReviewsPage } from '$lib/reviews.server';
import type { SupportedCreativeWorkType } from '$lib/types';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 12;
const MAX_CURSOR_LENGTH = 2_048;

function parseMediaType(value: string | null): SupportedCreativeWorkType | null {
	return value === 'movie' || value === 'tv_show' ? value : null;
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const tmdbId = Number(url.searchParams.get('tmdbId'));
	const creativeWorkType = parseMediaType(url.searchParams.get('type'));
	const cursor = url.searchParams.get('cursor');
	if (
		!Number.isSafeInteger(tmdbId) ||
		tmdbId <= 0 ||
		!creativeWorkType ||
		!cursor ||
		cursor.length > MAX_CURSOR_LENGTH
	) {
		return json({ message: 'Invalid media review request' }, { status: 400 });
	}

	try {
		return json(
			await getMediaReviewsPage({
				tmdbId,
				creativeWorkType,
				cursor,
				limit: PAGE_SIZE,
				viewerDid: locals.did
			})
		);
	} catch (cause) {
		console.error('Could not load more media reviews from Contrail', cause);
		return json({ message: 'Could not load more reviews' }, { status: 502 });
	}
};
