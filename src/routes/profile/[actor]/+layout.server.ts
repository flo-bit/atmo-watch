import { contrail } from '$lib/contrail';
import { isActorIdentifier } from '@atcute/lexicons/syntax';
import { error } from '@sveltejs/kit';
import { toReview } from '$lib/reviews.server';
import type { LayoutServerLoad } from './$types';

function getBlobCid(value: unknown) {
	if (!value || typeof value !== 'object') return undefined;

	const blob = value as { ref?: { $link?: unknown }; cid?: unknown };
	if (typeof blob.ref?.$link === 'string') return blob.ref.$link;
	return typeof blob.cid === 'string' ? blob.cid : undefined;
}

function parseActor(value: string) {
	if (isActorIdentifier(value)) return value;

	try {
		const decoded = decodeURIComponent(value);
		return isActorIdentifier(decoded) ? decoded : undefined;
	} catch {
		return undefined;
	}
}

export const load: LayoutServerLoad = async ({ params }) => {
	const actor = parseActor(params.actor);
	if (!actor) error(404, 'Profile not found');
	const [reviews, profileResponse] = await Promise.all([
		contrail.get('watch.atmo.review.listRecords', {
			params: { actor, profiles: true }
		}),
		contrail.get('watch.atmo.getProfile', {
			params: { actor }
		})
	]);

	if (!reviews.ok) {
		if (reviews.status === 400 || reviews.status === 404) error(404, 'Profile not found');
		error(502, 'Could not load reviews');
	}

	const profiles = profileResponse.ok
		? profileResponse.data.profiles
		: (reviews.data.profiles ?? []);
	const profileEntry =
		profiles.find((entry) => entry.collection === 'app.bsky.actor.profile') ?? profiles[0];
	const avatarCid = getBlobCid(profileEntry?.value?.avatar);
	const did = profileEntry?.did ?? actor;
	const handle = profileEntry?.handle ?? actor.replace(/^@/, '');

	const reviewEntries = reviews.data.records.flatMap((record) => {
		const review = toReview(record, handle);
		return review ? [review] : [];
	});

	return {
		reviews: reviewEntries,
		profile: {
			did,
			handle,
			avatarUrl: avatarCid
				? `https://cdn.bsky.app/img/avatar/plain/${did}/${avatarCid}@jpeg`
				: undefined
		}
	};
};
