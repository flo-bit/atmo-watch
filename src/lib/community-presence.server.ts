import { cachePublicData, getPublicDataCache } from '$lib/cache.server';
import { contrail } from '$lib/contrail-client.server';
import type { SupportedCreativeWorkType } from '$lib/types';

export type CommunityPresence = {
	hasReviews: boolean;
	hasVideos: boolean;
	hasDescendantVideos: boolean;
};

// Anonymous first-time community content may take up to five minutes to appear.
// Authenticated catalog loads bypass this hint entirely, including cached negatives.
const PRESENCE_TTL = 5 * 60;

export function hasCommunityContent(presence: CommunityPresence) {
	return presence.hasReviews || presence.hasVideos || presence.hasDescendantVideos;
}

export async function getCommunityPresence(
	tmdbId: number,
	creativeWorkType: SupportedCreativeWorkType
): Promise<CommunityPresence | null> {
	try {
		return await cachePublicData(
			getPublicDataCache(PRESENCE_TTL),
			`contrail:community-presence:v1:${creativeWorkType}:${tmdbId}`,
			async () => {
				const response = await contrail.get('watch.atmo.review.getCommunityPresence', {
					params: { tmdbId, creativeWorkType }
				});
				if (!response.ok) {
					throw new Error(`Could not load community presence (${response.status})`);
				}
				const presence = response.data;
				if (
					typeof presence.hasReviews !== 'boolean' ||
					typeof presence.hasVideos !== 'boolean' ||
					typeof presence.hasDescendantVideos !== 'boolean'
				) {
					throw new Error('Invalid community presence response');
				}
				return presence;
			}
		);
	} catch (cause) {
		// Unknown is not empty: preserve enrichment and indexing on API/cache errors.
		console.error('Could not load community presence from Contrail', cause);
		return null;
	}
}
