import { contrail } from '$lib/contrail';
import { isActorIdentifier } from '@atcute/lexicons/syntax';
import { error } from '@sveltejs/kit';
import type { Item, MediaKind, TmdbRef } from '$lib/types';
import type { LayoutServerLoad } from './$types';

function getTmdbRef(id: number, mediaType: MediaKind): TmdbRef {
	return `tmdb:${mediaType === 'movie' ? 'm' : 's'}-${id}`;
}

function getBlobCid(value: unknown) {
	if (!value || typeof value !== 'object') return undefined;

	const blob = value as { ref?: { $link?: unknown }; cid?: unknown };
	if (typeof blob.ref?.$link === 'string') return blob.ref.$link;
	return typeof blob.cid === 'string' ? blob.cid : undefined;
}

export const load: LayoutServerLoad = async ({ params }) => {
	const actor = params.actor;
	if (!isActorIdentifier(actor)) error(404, 'Profile not found');
	const [reviews, profileResponse] = await Promise.all([
		contrail.get('watch.atmo.review.listRecords', {
			params: { actor }
		}),
		contrail.get('watch.atmo.getProfile', {
			params: { actor }
		})
	]);

	if (!reviews.ok) error(502, 'Could not load reviews');
	if (!profileResponse.ok)
		error(profileResponse.status === 404 ? 404 : 502, 'Could not load profile');

	const items: Item[] = [];
	for (const review of reviews.data.records) {
		const value = review.value;
		if (value.creativeWorkType !== 'tv_show' && value.creativeWorkType !== 'movie') continue;
		if (!value.identifiers.tmdbId || !value.posterUrl || !value.title) continue;

		const id = Number(value.identifiers.tmdbId);
		if (!Number.isSafeInteger(id) || id <= 0) continue;

		const mediaType: MediaKind = value.creativeWorkType === 'tv_show' ? 'tv' : 'movie';
		items.push({
			id,
			ref: getTmdbRef(id, mediaType),
			media_type: mediaType,
			title: value.title,
			poster_path: value.posterUrl,
			backdrop_path: value.backdropUrl ?? null,
			overview: value.text ?? ''
		});
	}

	const profileEntry =
		profileResponse.data.profiles.find((entry) => entry.collection === 'app.bsky.actor.profile') ??
		profileResponse.data.profiles[0];
	const avatarCid = getBlobCid(profileEntry?.value?.avatar);
	const did = profileEntry?.did ?? actor;

	return {
		items,
		profile: {
			did,
			handle: profileEntry?.handle ?? actor.replace(/^@/, ''),
			avatarUrl: avatarCid
				? `https://cdn.bsky.app/img/avatar/plain/${did}/${avatarCid}@jpeg`
				: undefined
		}
	};
};
