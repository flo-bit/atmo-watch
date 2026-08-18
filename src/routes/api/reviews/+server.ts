import { json } from '@sveltejs/kit';
import { getRecentReviewsPage } from '$lib/reviews.server';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 10;
const MAX_CURSOR_LENGTH = 2_048;

export const GET: RequestHandler = async ({ url, locals }) => {
	const cursor = url.searchParams.get('cursor');
	if (!cursor || cursor.length > MAX_CURSOR_LENGTH) {
		return json({ message: 'Invalid review cursor' }, { status: 400 });
	}

	try {
		return json(
			await getRecentReviewsPage({
				cursor,
				limit: PAGE_SIZE,
				viewerDid: locals.did
			})
		);
	} catch (cause) {
		console.error('Could not load more recent reviews from Contrail', cause);
		return json({ message: 'Could not load more reviews' }, { status: 502 });
	}
};
