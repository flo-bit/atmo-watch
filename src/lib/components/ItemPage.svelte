<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Dialog } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import AddToListMenu from './AddToListMenu.svelte';
	import Avatar from './Avatar.svelte';
	import BackdropGallery from './BackdropGallery.svelte';
	import Container from './Container.svelte';
	import ExternalRatings from './ExternalRatings.svelte';
	import ItemCard from './ItemCard.svelte';
	import ItemsGrid from './ItemsGrid.svelte';
	import Review from './Review.svelte';
	import TrailerDialog from './TrailerDialog.svelte';
	import TvScheduleCard from './TvScheduleCard.svelte';
	import TvSeasons from './TvSeasons.svelte';
	import WatchedButton from './WatchedButton.svelte';
	import { backdropUrl, logoUrl, posterUrl, profileUrl } from '$lib/images';
	import { loginDialog } from '$lib/login.svelte';
	import { reviewDialog } from '$lib/review.svelte';
	import { slugify } from '$lib/utils';
	import type { getMediaPage } from '$lib/tmdb.server';
	import type { ReviewCardModel } from '$lib/types';

	type ItemPageData = Awaited<ReturnType<typeof getMediaPage>> & {
		did: string | null;
		reviews: ReviewCardModel[];
		today: string;
	};

	function startReview() {
		if (!data.did) {
			loginDialog.show();
			return;
		}

		reviewDialog.show(data.item);
	}

	function formatRuntime(runtime: number | null) {
		if (!runtime) return null;

		const hours = Math.floor(runtime / 60);
		const minutes = runtime % 60;
		if (!hours) return `${minutes}m`;
		return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
	}

	let { data }: { data: ItemPageData } = $props();
	let canonicalUrl = $derived(`${page.url.origin}${page.url.pathname}`);
	let ogImageUrl = $derived(`${canonicalUrl.replace(/\/$/, '')}/og.png`);
	let releaseYear = $derived(data.item.releaseDate?.slice(0, 4) || null);
	let seasonLabel = $derived(
		data.item.numberOfSeasons
			? `${data.item.numberOfSeasons} ${data.item.numberOfSeasons === 1 ? 'season' : 'seasons'}`
			: null
	);
	let mediaFacts = $derived(
		[
			releaseYear,
			formatRuntime(data.item.runtime),
			data.item.creativeWorkType === 'tv_show' ? seasonLabel : null
		].filter((fact): fact is string => fact !== null)
	);
	let titleLogoUrl = $derived(logoUrl(data.logo?.path, 'w500'));
	let titleLogoOriginalUrl = $derived(logoUrl(data.logo?.path, 'original'));
	let hasHeroImage = $derived(Boolean(data.item.backdrop || data.item.poster));
	let averageReviewRating = $derived(
		data.reviews.length > 0
			? data.reviews.reduce((total, review) => total + review.rating, 0) / data.reviews.length
			: 0
	);
	let showAllReviews = $state(false);
	let selectedReview = $state<ReviewCardModel | null>(null);
	let reviewPopupOpen = $state(false);
	let showAllRecommendations = $state(false);
	let showAllCast = $state(false);
	let writtenReviews = $derived(data.reviews.filter((review) => review.text.trim()));
	let displayedReviews = $derived(showAllReviews ? writtenReviews : writtenReviews.slice(0, 3));
	let desktopRecommendations = $derived(
		showAllRecommendations ? data.recommendations : data.recommendations.slice(0, 10)
	);
	function showFullReview(review: ReviewCardModel) {
		selectedReview = review;
		reviewPopupOpen = true;
	}

	function handleReviewPopupOpenChange(open: boolean) {
		reviewPopupOpen = open;
		if (!open) selectedReview = null;
	}

	$effect(() => {
		if (data.item.tmdbId > 0 && data.item.creativeWorkType) {
			showAllReviews = false;
			reviewPopupOpen = false;
			selectedReview = null;
			showAllRecommendations = false;
			showAllCast = false;
		}
	});
</script>

{#snippet reviewButton()}
	<button
		type="button"
		onclick={startReview}
		class="inline-flex h-12 w-full max-w-lg items-center justify-center gap-2.5 rounded-full bg-base-50 px-6 text-sm font-bold text-base-950 shadow-xl shadow-black/30 transition hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 active:scale-[0.99] lg:h-10 lg:w-auto lg:min-w-48 lg:px-5 lg:text-xs"
	>
		<svg class="size-5 lg:size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path
				d="m12 2.75 2.82 5.71 6.3.92-4.56 4.44 1.08 6.28L12 17.13 6.36 20.1l1.08-6.28-4.56-4.44 6.3-.92L12 2.75Z"
			/>
		</svg>
		Rate &amp; review
	</button>
{/snippet}

{#snippet mediaTitle()}
	<h1
		class={titleLogoUrl
			? 'sr-only'
			: 'text-[2.5rem] leading-[1.05] font-bold tracking-tight text-white drop-shadow-xl sm:text-5xl'}
	>
		{data.item.title}
	</h1>
	{#if titleLogoUrl && titleLogoOriginalUrl}
		<picture class="contents">
			<source
				media="(max-width: 1023px)"
				srcset={`${titleLogoUrl} 1x, ${titleLogoOriginalUrl} 2x`}
			/>
			<img
				src={titleLogoUrl}
				alt=""
				width={data.logo?.width}
				height={data.logo?.height}
				fetchpriority="high"
				class="mx-auto max-h-36 w-full max-w-[20rem] object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] sm:max-w-sm"
			/>
		</picture>
	{/if}
{/snippet}

<svelte:head>
	<title>{data.item.title} | atmo.watch</title>
	<meta name="description" content={`Rate and review "${data.item.title}" on atmo.watch`} />

	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={`${data.item.title} | atmo.watch`} />
	<meta property="og:description" content={`Rate and review "${data.item.title}" on atmo.watch`} />
	<meta property="og:image" content={ogImageUrl} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta property="twitter:domain" content="atmo.watch" />
	<meta property="twitter:url" content={canonicalUrl} />
	<meta name="twitter:title" content={`${data.item.title} | atmo.watch`} />
	<meta name="twitter:description" content={`Rate and review "${data.item.title}" on atmo.watch`} />
	<meta name="twitter:image" content={ogImageUrl} />
</svelte:head>

<main class="relative isolate min-h-dvh overflow-hidden bg-base-950 text-white">
	{#if data.item.backdrop}
		<img
			src={backdropUrl(data.item.backdrop, 'w300')}
			alt=""
			class="pointer-events-none fixed inset-0 z-0 hidden size-full scale-110 object-cover object-center blur-3xl lg:block"
		/>
	{:else if data.item.poster}
		<img
			src={posterUrl(data.item.poster, 'w342')}
			alt=""
			class="pointer-events-none fixed inset-0 z-0 hidden size-full scale-110 object-cover object-center blur-3xl lg:block"
		/>
	{/if}
	<div class="pointer-events-none fixed inset-0 z-0 hidden bg-black/60 lg:block"></div>

	{#if data.item.poster}
		<img
			src={posterUrl(data.item.poster, 'w342')}
			alt=""
			class="pointer-events-none fixed inset-0 z-0 size-full scale-110 object-cover object-center blur-3xl lg:hidden"
		/>
		<div class="pointer-events-none fixed inset-0 z-0 bg-black/60 lg:hidden"></div>
	{/if}

	<section class="relative isolate z-10 overflow-hidden lg:pt-12">
		<div class={`relative isolate lg:hidden ${hasHeroImage ? 'pt-[35svh]' : 'pt-14'}`}>
			{#if data.item.backdrop}
				<img
					src={backdropUrl(data.item.backdrop, 'w1280')}
					alt=""
					class="absolute inset-0 -z-30 size-full object-cover object-center"
					style="-webkit-mask-image: linear-gradient(to bottom, black 0%, black 40%, transparent 100%); mask-image: linear-gradient(to bottom, black 0%, black 40%, transparent 100%);"
				/>
			{:else if data.item.poster}
				<img
					src={posterUrl(data.item.poster, 'w780')}
					alt=""
					class="absolute inset-0 -z-30 size-full object-cover object-center"
					style="-webkit-mask-image: linear-gradient(to bottom, black 0%, black 40%, transparent 100%); mask-image: linear-gradient(to bottom, black 0%, black 40%, transparent 100%);"
				/>
			{/if}
			<div class="mx-auto max-w-3xl px-4 text-center sm:px-8">
				{@render mediaTitle()}
			</div>
		</div>

		<div class="mx-auto w-full max-w-4xl px-4 sm:px-8 md:pl-24 lg:px-8">
			<div
				class={`lg:grid lg:items-start lg:gap-10 ${data.item.poster ? 'lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]' : 'lg:grid-cols-1'}`}
			>
				{#if data.item.poster}
					<img
						src={posterUrl(data.item.poster, 'w780')}
						alt="Poster for {data.item.title}"
						class="hidden aspect-2/3 w-full rounded-2xl border border-white/10 object-cover shadow-2xl shadow-black/50 lg:block"
					/>
				{/if}

				<div class="mx-auto max-w-3xl min-w-0 text-center lg:mx-0 lg:text-left">
					<h1 class="hidden text-4xl leading-tight font-bold tracking-tight text-white lg:block">
						{data.item.title}
					</h1>

					<div
						class="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-xs font-medium text-base-200 lg:mt-3 lg:justify-start lg:text-sm"
					>
						{#each mediaFacts as fact, index (fact)}
							{#if index > 0}
								<span class="text-base-500" aria-hidden="true">•</span>
							{/if}
							<span>{fact}</span>
						{/each}
					</div>

					<div class="mt-4 flex justify-center lg:mt-3 lg:justify-start">
						<ExternalRatings
							popfeedScore={data.reviews.length > 0 ? averageReviewRating : null}
							popfeedRatingCount={data.reviews.length}
							imdbId={data.imdb_id}
							imdbVotes={data.imdb_votes}
							ratings={data.ratings}
						/>
					</div>

					<div
						class="mt-8 flex flex-col items-center lg:mt-5 lg:flex-row lg:items-center lg:justify-start lg:gap-3"
					>
						<div class="flex w-full justify-center lg:w-auto lg:justify-start">
							{@render reviewButton()}
						</div>

						<div
							class={`mt-2 grid w-full max-w-md ${data.trailer_url ? 'grid-cols-3' : 'grid-cols-2'} gap-1 lg:mt-0 lg:flex lg:w-auto lg:gap-2`}
						>
							<AddToListMenu item={data.item} did={data.did} variant="action" />
							{#if data.trailer_url}
								<TrailerDialog url={data.trailer_url} title={data.item.title} variant="action" />
							{/if}
							<WatchedButton item={data.item} did={data.did} />
						</div>
					</div>

					{#if data.item.overview}
						<div class="mt-7 hidden max-w-3xl lg:mt-5 lg:block">
							<p class="text-sm leading-6 text-base-100">{data.item.overview}</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<Container class="relative z-10 pb-12">
		<div class="px-4">
			{#if data.item.overview}
				<section
					aria-label="Overview"
					class="border-t border-white/10 pt-6 text-sm text-white lg:hidden"
				>
					<p class="leading-6 text-base-200 sm:text-base sm:leading-7">{data.item.overview}</p>
				</section>
			{/if}

			{#if data.item.creativeWorkType === 'tv_show' && data.nextEpisode?.airDate}
				<TvScheduleCard item={data.item} nextEpisode={data.nextEpisode} today={data.today} />
			{/if}

			{#if data.item.creativeWorkType === 'tv_show'}
				<TvSeasons
					item={data.item}
					seasons={data.seasons}
					nextEpisode={data.nextEpisode}
					today={data.today}
				/>
			{/if}

			{#if writtenReviews.length > 0}
				<section class="mt-10 border-t border-white/10 pt-6 text-sm text-white">
					<h2 class="text-lg font-semibold tracking-tight">Reviews</h2>
					<div
						class="mt-4 flex snap-x snap-mandatory [scrollbar-width:none] items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-3 lg:hidden [&::-webkit-scrollbar]:hidden"
					>
						{#each writtenReviews as review (review.uri)}
							<Review
								{review}
								viewerDid={data.did}
								showItem={false}
								compact={true}
								onOpen={() => showFullReview(review)}
								class="w-[82vw] max-w-sm shrink-0 snap-start rounded-xl border border-white/10 bg-black/25 backdrop-blur-xl"
							/>
						{/each}
					</div>
					<div class="mt-4 hidden max-w-2xl flex-col gap-4 lg:flex">
						{#each displayedReviews as review (review.uri)}
							<Review {review} viewerDid={data.did} showItem={false} />
						{/each}
					</div>

					{#if !showAllReviews && writtenReviews.length > 3}
						<button
							type="button"
							onclick={() => (showAllReviews = true)}
							class="mt-5 hidden h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 lg:inline-flex"
						>
							see more reviews
							<svg
								class="size-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.8"
									d="m6 9 6 6 6-6"
								/>
							</svg>
						</button>
					{/if}
				</section>
			{/if}

			{#if data.recommendations.length > 0}
				<section class="mt-10 border-t border-white/10 pt-6 text-sm text-white">
					<h2 class="text-lg font-semibold tracking-tight">Similar</h2>
					<div
						class="mt-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto overscroll-x-contain pb-3 lg:hidden [&::-webkit-scrollbar]:hidden"
					>
						{#each data.recommendations as item (`${item.creativeWorkType}:${item.tmdbId}`)}
							<div class="w-32 shrink-0 snap-start sm:w-36">
								<ItemCard {item} />
							</div>
						{/each}
					</div>
					<div class="hidden lg:block">
						<ItemsGrid items={desktopRecommendations} class="mt-4" />
					</div>

					{#if !showAllRecommendations && data.recommendations.length > 10}
						<button
							type="button"
							onclick={() => (showAllRecommendations = true)}
							class="mt-5 hidden h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 lg:inline-flex"
						>
							view more
							<svg
								class="size-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.8"
									d="m6 9 6 6 6-6"
								/>
							</svg>
						</button>
					{/if}
				</section>
			{/if}

			{#if data.cast.length > 0}
				<section class="mt-10 border-t border-white/10 pt-6 text-sm text-white">
					<h2 class="text-lg font-semibold tracking-tight">Cast</h2>
					<div
						class="mt-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto overscroll-x-contain pb-3 lg:grid lg:grid-cols-5 lg:gap-x-4 lg:gap-y-6 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
					>
						{#each data.cast as castMember, index (castMember.id)}
							<a
								href={resolve('/cast/[id]', {
									id: `${castMember.id}-${slugify(castMember.name)}`
								})}
								class={`flex w-24 min-w-0 shrink-0 snap-start flex-col items-center gap-1.5 transition-opacity hover:opacity-75 sm:w-28 lg:w-auto ${showAllCast || index < 10 ? 'lg:flex' : 'lg:hidden'}`}
							>
								<Avatar
									src={profileUrl(castMember.profile_path, 'h632')}
									alt={castMember.name}
									class="aspect-square w-full"
								/>
								<span class="line-clamp-2 text-center text-xs font-medium">{castMember.name}</span>
								<span class="line-clamp-2 text-center text-xs text-base-400"
									>{castMember.character}</span
								>
							</a>
						{/each}
					</div>

					{#if !showAllCast && data.cast.length > 10}
						<button
							type="button"
							onclick={() => (showAllCast = true)}
							class="mt-5 hidden h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 lg:inline-flex"
						>
							show more
							<svg
								class="size-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.8"
									d="m6 9 6 6 6-6"
								/>
							</svg>
						</button>
					{/if}
				</section>
			{/if}

			{#if data.backdrops.length > 0}
				<section class="mt-10 border-t border-white/10 pt-6 pb-8 text-sm text-white">
					<h2 class="text-lg font-semibold tracking-tight">Backdrops</h2>
					<BackdropGallery images={data.backdrops} title={data.item.title} />
				</section>
			{/if}
		</div>
	</Container>
</main>

{#if selectedReview}
	<Dialog.Root bind:open={reviewPopupOpen} onOpenChange={handleReviewPopupOpenChange}>
		<Dialog.Portal>
			<Dialog.Overlay class="fixed inset-0 z-100 bg-black/75 backdrop-blur-md" />
			<Dialog.Content
				class="fixed top-1/2 left-1/2 z-101 max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-base-950/95 p-5 text-white shadow-2xl backdrop-blur-xl outline-none"
			>
				<Dialog.Title class="sr-only">
					Full review by @{selectedReview.author.handle.replace(/^@/, '')}
				</Dialog.Title>
				<Dialog.Description class="sr-only">
					Read the complete review and interact with it.
				</Dialog.Description>

				<Dialog.Close
					class="absolute top-3 right-3 z-10 inline-flex size-8 items-center justify-center rounded-full bg-black/35 text-base-300 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
				>
					<X class="size-4" strokeWidth={1.8} aria-hidden="true" />
					<span class="sr-only">Close review</span>
				</Dialog.Close>

				<div class="pr-7">
					<Review review={selectedReview} viewerDid={data.did} showItem={false} class="py-0" />
				</div>
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{/if}
