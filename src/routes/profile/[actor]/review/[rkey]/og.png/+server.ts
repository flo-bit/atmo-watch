import type { ResourceUri } from '@atcute/lexicons';
import { isActorIdentifier, isRecordKey } from '@atcute/lexicons/syntax';
import { ImageResponse } from '@ethercorps/sveltekit-og';
import { error, type RequestHandler } from '@sveltejs/kit';
import { getAtprotoCdnImageUrl } from '$lib/atproto/images';
import { contrail } from '$lib/contrail-client.server';
import { backdropUrl, logoUrl, posterUrl } from '$lib/images';
import { toReview } from '$lib/reviews.server';
import { getMediaHeader } from '$lib/tmdb.server';
import type { MediaLogo, ReviewCardModel } from '$lib/types';

function parseActor(value: string | undefined) {
	if (!value) return null;
	if (isActorIdentifier(value)) return value;

	try {
		const decoded = decodeURIComponent(value);
		return isActorIdentifier(decoded) ? decoded : null;
	} catch {
		return null;
	}
}

function safeText(value: string) {
	return value.replaceAll('<', '‹').replaceAll('>', '›');
}

function safeUrl(value: string) {
	return value.replaceAll('"', '%22').replaceAll('<', '%3C').replaceAll('>', '%3E');
}

function toOpenGraphImageUrl(value: string | undefined) {
	return value?.replace(/@webp(?=$|[?#])/, '@jpeg');
}

function truncate(value: string, maximumLength: number) {
	const characters = [...value];
	return characters.length > maximumLength
		? `${characters
				.slice(0, maximumLength - 1)
				.join('')
				.trimEnd()}…`
		: value;
}

const STAR_PATH =
	'M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z';

function ratingStars(rating: number) {
	const starRating = Math.max(0, Math.min(10, rating)) / 2;

	return Array.from({ length: 5 }, (_, index) => {
		const fill = Math.max(0, Math.min(1, starRating - index));
		return `<div tw="relative flex h-9 w-9">
		<svg width="36" height="36" viewBox="0 0 24 24" fill="#52525b"><path d="${STAR_PATH}" /></svg>
		${
			fill > 0
				? `<div tw="absolute left-0 top-0 flex h-9 overflow-hidden" style="width: ${fill * 100}%">
			<svg width="36" height="36" viewBox="0 0 24 24" fill="#e879f9" style="min-width: 36px;"><path d="${STAR_PATH}" /></svg>
		</div>`
				: ''
		}
	</div>`;
	}).join('');
}

function template({
	review,
	backdrop,
	logo,
	avatarUrl,
	displayName
}: {
	review: ReviewCardModel;
	backdrop: string | undefined;
	logo: MediaLogo | null;
	avatarUrl: string | undefined;
	displayName: string | undefined;
}) {
	const wordmark = logoUrl(logo?.path, 'original');
	const handle = review.author.handle.replace(/^@/, '');
	const authorName = truncate(displayName?.trim() || `@${handle}`, 60);
	const title = truncate(review.media.title, 90);
	const normalizedReview = review.text.replace(/\s+/g, ' ').trim();
	const reviewExcerpt = review.containsSpoilers ? '' : truncate(normalizedReview, 220);
	const initial = [...authorName][0]?.toLocaleUpperCase('en-US') ?? '?';

	return `
<div tw="relative flex h-full w-full overflow-hidden" style="background-color: #09090b;">
	<div tw="absolute bottom-0 left-0 right-0 top-0 flex" style="background-color: #701a75;">
		${backdrop ? `<img src="${safeUrl(backdrop)}" alt="" tw="h-full w-full" style="object-fit: cover;" />` : ''}
		<div tw="absolute bottom-0 left-0 right-0 top-0 flex" style="background-color: rgba(9, 9, 11, 0.52);"></div>
	</div>

	<div
		tw="absolute bottom-0 left-0 right-0 flex h-[500px]"
		style="background-image: linear-gradient(to top, #09090b 0%, rgba(9, 9, 11, 0.9) 50%, rgba(9, 9, 11, 0) 100%);"
	></div>

	<div tw="absolute left-16 top-10 flex text-3xl font-bold tracking-tight text-fuchsia-400">
		atmo.watch
	</div>

	${
		wordmark
			? `<img src="${safeUrl(wordmark)}" alt="" tw="absolute right-16 top-10 h-[135px] w-[500px]" style="object-fit: contain; object-position: right top;" />`
			: `<div tw="absolute right-16 top-10 flex w-[650px] justify-end text-right text-5xl font-bold leading-tight tracking-tight text-white">${safeText(title)}</div>`
	}

	<div tw="absolute bottom-12 left-16 right-16 flex flex-col">
		<div tw="flex items-center">
			${
				avatarUrl
					? `<img src="${safeUrl(avatarUrl)}" alt="" tw="h-16 w-16 rounded-full border-2 border-white/20" style="object-fit: cover;" />`
					: `<div tw="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/20 text-2xl font-bold text-white" style="background-color: #27272a;">${safeText(initial)}</div>`
			}
			<div tw="ml-4 flex flex-col">
				<div tw="flex text-2xl font-semibold text-white">${safeText(authorName)}</div>
				${displayName?.trim() ? `<div tw="mt-1 flex text-lg" style="color: #a1a1aa;">@${safeText(handle)}</div>` : ''}
			</div>
		</div>

		<div tw="mt-5 flex">${ratingStars(review.rating)}</div>

		${reviewExcerpt ? `<div tw="mt-5 flex max-w-[1000px] text-[27px] leading-[1.35]" style="color: #f4f4f5;">“${safeText(reviewExcerpt)}”</div>` : ''}

	</div>
</div>`;
}

export const GET: RequestHandler = async ({ params }) => {
	const actor = parseActor(params.actor);
	if (!actor || !isRecordKey(params.rkey ?? '')) error(404, 'Rating not found');

	const profileResponse = await contrail.get('watch.atmo.getProfile', { params: { actor } });
	if (!profileResponse.ok) {
		if (profileResponse.status === 400 || profileResponse.status === 404) {
			error(404, 'Rating not found');
		}
		error(502, 'Could not load rating');
	}

	const bskyProfile = profileResponse.data.profiles.find(
		(entry) => entry.collection === 'app.bsky.actor.profile'
	);
	const popfeedProfile = profileResponse.data.profiles.find(
		(entry) => entry.collection === 'social.popfeed.actor.profile'
	);
	const profile = bskyProfile ?? popfeedProfile;
	if (!profile) error(404, 'Rating not found');

	const uri = `at://${profile.did}/social.popfeed.feed.review/${params.rkey}` as ResourceUri;
	const reviewResponse = await contrail.get('watch.atmo.review.getRecord', {
		params: { uri }
	});
	if (!reviewResponse.ok) {
		if (reviewResponse.status === 400 || reviewResponse.status === 404) {
			error(404, 'Rating not found');
		}
		error(502, 'Could not load rating');
	}

	const review = toReview(reviewResponse.data, profile.handle ?? profile.did);
	if (!review) error(404, 'Rating not found');

	const mediaHeader = await getMediaHeader(
		review.media.tmdbId,
		review.media.creativeWorkType
	).catch((cause) => {
		console.error('Could not load rating media from TMDB', cause);
		return null;
	});
	const avatar =
		bskyProfile?.value && 'avatar' in bskyProfile.value ? bskyProfile.value.avatar : undefined;
	const avatarUrl = toOpenGraphImageUrl(
		avatar ? getAtprotoCdnImageUrl({ did: profile.did, blob: avatar, preset: 'avatar' }) : undefined
	);
	const displayName = popfeedProfile?.value?.displayName ?? bskyProfile?.value?.displayName;
	const backdrop = toOpenGraphImageUrl(
		backdropUrl(mediaHeader?.item.backdrop, 'w1280') ??
			reviewResponse.data.value.backdropUrl ??
			reviewResponse.data.value.posterUrl ??
			posterUrl(mediaHeader?.item.poster ?? review.media.poster, 'w780')
	);

	return new ImageResponse(
		template({
			review: {
				...review,
				author: { ...review.author, displayName, avatarUrl }
			},
			backdrop,
			logo: mediaHeader?.logo ?? null,
			avatarUrl,
			displayName
		}),
		{
			width: 1200,
			height: 630,
			headers: {
				'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
			}
		}
	);
};
