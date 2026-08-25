import { json } from '@sveltejs/kit';
import { isActorIdentifier } from '@atcute/lexicons/syntax';
import { getProfileReviewsPage } from '$lib/reviews.server';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 30;
const MAX_CURSOR_LENGTH = 2_048;

export const GET: RequestHandler = async ({ url, locals }) => {
	const actor = url.searchParams.get('actor')?.trim() ?? '';
	const cursor = url.searchParams.get('cursor');
	if (!isActorIdentifier(actor) || !cursor || cursor.length > MAX_CURSOR_LENGTH) {
		return json({ message: 'Invalid profile review request' }, { status: 400 });
	}

	try {
		return json(
			await getProfileReviewsPage({
				actor,
				cursor,
				limit: PAGE_SIZE,
				viewerDid: locals.did
			})
		);
	} catch (cause) {
		console.error('Could not load more profile reviews from Contrail', cause);
		return json({ message: 'Could not load more reviews' }, { status: 502 });
	}
};
