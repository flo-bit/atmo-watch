import { json, type RequestHandler } from '@sveltejs/kit';
import { searchMedia, TMDBError } from '../../_lib/tmdb.server';

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';

	setHeaders({
		'Cache-Control': 'private, no-store'
	});

	if (query.length < 2) {
		return json([]);
	}

	try {
		return json(await searchMedia(query));
	} catch (cause) {
		if (cause instanceof TMDBError) {
			return json({ message: 'TMDB search is unavailable' }, { status: 502 });
		}

		throw cause;
	}
};
