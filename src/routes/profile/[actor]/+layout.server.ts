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

	const bskyProfile = response.data.profiles.find(
		(entry) => entry.collection === 'app.bsky.actor.profile'
	);
	const popfeedProfile = response.data.profiles.find(
		(entry) => entry.collection === 'social.popfeed.actor.profile'
	);
	const profileEntry = bskyProfile ?? popfeedProfile;
	if (!profileEntry) error(404, 'Profile not found');

	const did = profileEntry.did;
	const avatar =
		bskyProfile?.value && 'avatar' in bskyProfile.value ? bskyProfile.value.avatar : undefined;
	const popfeedBanner = popfeedProfile?.value?.banner;
	const bskyBanner = bskyProfile?.value?.banner;
	const banner = popfeedBanner ?? bskyBanner;
	const bannerUrl = banner
		? getAtprotoCdnImageUrl({ did, blob: banner, preset: 'banner' })
		: undefined;

	return {
		profile: {
			did,
			handle: profileEntry.handle ?? did,
			displayName: popfeedProfile?.value?.displayName ?? bskyProfile?.value?.displayName,
			description: popfeedProfile?.value?.description ?? bskyProfile?.value?.description,
			avatarUrl: avatar
				? getAtprotoCdnImageUrl({ did, blob: avatar, preset: 'avatar' })
				: undefined,
			bannerUrl
		}
	};
};
