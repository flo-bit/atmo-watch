import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPersonPage, TMDBError } from '$lib/tmdb.server';
import { mediaKey, parseTmdbId } from '$lib/utils';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseTmdbId(params.id);

	if (!id) {
		error(404, 'Not found');
	}

	try {
		const { combinedCredits: allCredits, personDetails } = await getPersonPage(id);
		const seen = new Set<string>();
		const combinedCredits = allCredits
			.filter((item) => {
				const key = mediaKey(item);
				if (!item.poster || seen.has(key)) return false;

				seen.add(key);
				return true;
			})
			.sort((a, b) => b.popularity - a.popularity);

		return { combinedCredits, personDetails };
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) {
			error(404, 'Not found');
		}

		throw cause;
	}
};
