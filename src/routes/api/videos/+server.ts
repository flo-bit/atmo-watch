import { json } from '@sveltejs/kit';
import { getRecentSubmittedVideosPage } from '$lib/videos.server';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 24;
const MAX_CURSOR_LENGTH = 2_048;

export const GET: RequestHandler = async ({ url }) => {
	const cursor = url.searchParams.get('cursor');
	if (!cursor || cursor.length > MAX_CURSOR_LENGTH) {
		return json({ message: 'Invalid video cursor' }, { status: 400 });
	}

	try {
		return json(await getRecentSubmittedVideosPage({ cursor, limit: PAGE_SIZE }));
	} catch (cause) {
		console.error('Could not load more recent videos from Contrail', cause);
		return json({ message: 'Could not load more videos' }, { status: 502 });
	}
};
