import type { Did } from '@atcute/lexicons';
import { getAtprotoCdnImageUrl } from '$lib/atproto/images';
import { contrail } from '$lib/contrail';
import type { LayoutServerLoad } from './$types';

async function getViewerAvatar(did: Did) {
	try {
		const response = await contrail.get('watch.atmo.getProfile', { params: { actor: did } });
		if (!response.ok) return undefined;

		const bskyProfile = response.data.profiles.find(
			(entry) => entry.collection === 'app.bsky.actor.profile'
		);
		const avatar =
			bskyProfile?.value && 'avatar' in bskyProfile.value ? bskyProfile.value.avatar : undefined;
		return avatar ? getAtprotoCdnImageUrl({ did, blob: avatar, preset: 'avatar' }) : undefined;
	} catch (cause) {
		console.error('Could not load viewer avatar from Contrail', cause);
		return undefined;
	}
}

export const load: LayoutServerLoad = async ({ locals }) => ({
	did: locals.did,
	avatarUrl: locals.did ? await getViewerAvatar(locals.did) : undefined
});
