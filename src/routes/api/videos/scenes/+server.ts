import { json, type RequestHandler } from '@sveltejs/kit';
import { getRandomSubmittedScenes } from '$lib/videos.server';

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const requestedLimit = Number(url.searchParams.get('limit') ?? 24);
	const limit =
		Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 48
			? requestedLimit
			: 24;

	setHeaders({ 'Cache-Control': 'private, no-store' });

	try {
		return json({ videos: await getRandomSubmittedScenes(limit) });
	} catch (cause) {
		console.error('Could not load more random scenes from Contrail', cause);
		return json({ message: 'Could not load scenes' }, { status: 502 });
	}
};
