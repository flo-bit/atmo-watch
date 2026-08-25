import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPersonPage, TMDBError } from '$lib/tmdb.server';
import { mediaKey, parseTmdbId } from '$lib/utils';
import type { MediaCredit } from '$lib/types';

function creditRelevanceScore(credit: MediaCredit) {
	// TMDB popularity measures current activity around the title, which lets
	// one-off appearances in long-running shows outrank an actor's best-known work.
	// Audience votes are a more stable baseline; billing order and episode count
	// make that baseline relevant to this particular actor.
	const roleWeight =
		credit.creativeWorkType === 'tv_show'
			? Math.sqrt(Math.min(Math.max(credit.episodeCount ?? 1, 1), 10))
			: 1 / Math.sqrt(Math.max(credit.order + 1, 1));

	return credit.voteCount * roleWeight;
}

function compareCredits(left: MediaCredit, right: MediaCredit) {
	return (
		creditRelevanceScore(right) - creditRelevanceScore(left) ||
		right.voteCount - left.voteCount ||
		right.popularity - left.popularity
	);
}

export const load: PageServerLoad = async ({ params }) => {
	const id = parseTmdbId(params.id);

	if (!id) {
		error(404, 'Not found');
	}

	try {
		const { combinedCredits: allCredits, personDetails } = await getPersonPage(id);
		const seen = new Set<string>();
		const combinedCredits = [...allCredits]
			.filter((item) => item.poster)
			.sort(compareCredits)
			.filter((item) => {
				const key = mediaKey(item);
				if (seen.has(key)) return false;

				seen.add(key);
				return true;
			});

		return { combinedCredits, personDetails };
	} catch (cause) {
		if (cause instanceof TMDBError && cause.http_status_code === 404) {
			error(404, 'Not found');
		}

		throw cause;
	}
};
