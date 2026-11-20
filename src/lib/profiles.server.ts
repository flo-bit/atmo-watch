import type { ActorIdentifier } from '@atcute/lexicons';
import { getAtprotoCdnImageUrl } from '$lib/atproto/images';
import { contrail } from '$lib/contrail-client.server';

/** Resolves a handle or DID to its public profile; `null` when there is no such account. */
export async function getActorProfile(actor: ActorIdentifier) {
	const response = await contrail.get('watch.atmo.getProfile', { params: { actor } });
	if (!response.ok) {
		if (response.status === 400 || response.status === 404) return null;
		throw new Error(`Could not load profile from Contrail (${response.status})`);
	}

	const bskyProfile = response.data.profiles.find(
		(entry) => entry.collection === 'app.bsky.actor.profile'
	);
	const popfeedProfile = response.data.profiles.find(
		(entry) => entry.collection === 'social.popfeed.actor.profile'
	);
	const profileEntry = bskyProfile ?? popfeedProfile;
	if (!profileEntry) return null;

	const did = profileEntry.did;
	const avatar =
		bskyProfile?.value && 'avatar' in bskyProfile.value ? bskyProfile.value.avatar : undefined;
	const popfeedBanner = popfeedProfile?.value?.banner;
	const legacyPopfeedBannerUrl =
		popfeedProfile?.value && 'bannerUrl' in popfeedProfile.value
			? popfeedProfile.value.bannerUrl
			: undefined;
	const bskyBanner = bskyProfile?.value?.banner;
	const bannerUrl =
		(popfeedBanner
			? getAtprotoCdnImageUrl({ did, blob: popfeedBanner, preset: 'banner' })
			: undefined) ??
		legacyPopfeedBannerUrl ??
		(bskyBanner ? getAtprotoCdnImageUrl({ did, blob: bskyBanner, preset: 'banner' }) : undefined);

	return {
		did,
		handle: profileEntry.handle ?? did,
		displayName: popfeedProfile?.value?.displayName ?? bskyProfile?.value?.displayName,
		avatarUrl: avatar ? getAtprotoCdnImageUrl({ did, blob: avatar, preset: 'avatar' }) : undefined,
		bannerUrl
	};
}
