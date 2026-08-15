import { getAtprotoCdnImageUrl } from '$lib/atproto/images';
import { contrail } from '$lib/contrail';
import { isActorIdentifier } from '@atcute/lexicons/syntax';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

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

	const response = await contrail.get('watch.atmo.getProfile', {
		params: { actor }
	});
	if (!response.ok) {
		if (response.status === 400 || response.status === 404) error(404, 'Profile not found');
		error(502, 'Could not load profile');
	}

	const profileEntry =
		response.data.profiles.find((entry) => entry.collection === 'app.bsky.actor.profile') ??
		response.data.profiles[0];
	if (!profileEntry) error(404, 'Profile not found');

	const did = profileEntry.did;
	return {
		profile: {
			did,
			handle: profileEntry.handle ?? did,
			displayName: profileEntry.value?.displayName,
			avatarUrl: profileEntry.value?.avatar
				? getAtprotoCdnImageUrl({ did, blob: profileEntry.value.avatar, preset: 'avatar' })
				: undefined
		}
	};
};
