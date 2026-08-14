import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPersonPage, TMDBError } from '../../_lib/tmdb.server';
import { parseTmdbId } from '../../_lib/utils';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseTmdbId(params.id);

	if (!id) {
		error(404, 'Not found');
	}

	try {
		const { combinedCredits: allCredits, personDetails } = await getPersonPage(id);
		const seen = new Set<number>();
		const combinedCredits = allCredits
			.filter((item) => {
				if (!item.poster_path || seen.has(item.id)) return false;

				seen.add(item.id);
				return true;
			})
			.sort((a, b) => (b.order ?? 0) - (a.order ?? 0));

		return { combinedCredits, personDetails };
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) {
			error(404, 'Not found');
		}

		throw cause;
	}
};
