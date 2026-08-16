<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Avatar from './Avatar.svelte';
	import Container from './Container.svelte';
	import ExternalRatings from './ExternalRatings.svelte';
	import ItemsGrid from './ItemsGrid.svelte';
	import Review from './Review.svelte';
	import TrailerDialog from './TrailerDialog.svelte';
	import { backdropUrl, posterUrl, profileUrl } from '$lib/images';
	import { loginDialog } from '$lib/login.svelte';
	import { reviewDialog } from '$lib/review.svelte';
	import { slugify } from '$lib/utils';
	import type { getMediaPage } from '$lib/tmdb.server';
	import type { ReviewCardModel } from '$lib/types';

	type ItemPageData = Awaited<ReturnType<typeof getMediaPage>> & {
		did: string | null;
		reviews: ReviewCardModel[];
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
	let mediaTypeLabel = $derived(data.item.creativeWorkType === 'tv_show' ? 'TV series' : 'Movie');
	let releaseYear = $derived(data.item.releaseDate?.slice(0, 4) || null);
	let seasonLabel = $derived(
		data.item.numberOfSeasons
			? `${data.item.numberOfSeasons} ${data.item.numberOfSeasons === 1 ? 'season' : 'seasons'}`
			: null
	);
	let mediaFacts = $derived(
		[
			releaseYear,
			data.item.creativeWorkType === 'tv_show' ? seasonLabel : null,
			formatRuntime(data.item.runtime)
		].filter((fact): fact is string => fact !== null)
	);
	let hasSecondaryVisual = $derived(Boolean(data.trailer_url || data.item.backdrop));
	let averageReviewRating = $derived(
		data.reviews.length > 0
			? data.reviews.reduce((total, review) => total + review.rating, 0) / data.reviews.length
			: 0
	);
	let showAllReviews = $state(false);
	let showAllRecommendations = $state(false);
	let writtenReviews = $derived(data.reviews.filter((review) => review.text.trim()));
	let displayedReviews = $derived(showAllReviews ? writtenReviews : writtenReviews.slice(0, 3));
	let mobileRecommendations = $derived(
		showAllRecommendations ? data.recommendations : data.recommendations.slice(0, 6)
	);
	let desktopRecommendations = $derived(
		showAllRecommendations ? data.recommendations : data.recommendations.slice(0, 10)
	);

	$effect(() => {
		if (data.item.tmdbId > 0 && data.item.creativeWorkType) {
			showAllReviews = false;
			showAllRecommendations = false;
		}
	});
</script>

{#snippet reviewButton()}
	<button
		type="button"
		onclick={startReview}
		class="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
	>
		<svg class="size-4 text-accent-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path
				d="m12 2.75 2.82 5.71 6.3.92-4.56 4.44 1.08 6.28L12 17.13 6.36 20.1l1.08-6.28-4.56-4.44 6.3-.92L12 2.75Z"
			/>
		</svg>
		review
	</button>
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
		<div
			class="pointer-events-none absolute inset-x-0 top-0 h-[36rem] overflow-hidden sm:h-[46rem]"
		>
			<img
				src={backdropUrl(data.item.backdrop)}
				alt=""
				class="absolute inset-0 size-full scale-105 object-cover object-center opacity-35 blur-[2px]"
			/>
			<div
				class="absolute inset-0 bg-gradient-to-b from-black/25 via-base-950/75 to-base-950"
			></div>
		</div>
	{/if}

	<Container class="relative z-10 pt-8 pb-12 sm:pt-12">
		<div class="px-4">
			{#if data.item.poster || hasSecondaryVisual}
				<div
					class={`gap-2 sm:gap-4 ${
						data.item.poster && hasSecondaryVisual
							? 'grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)]'
							: ''
					}`}
				>
					{#if data.item.poster}
						<img
							src={posterUrl(data.item.poster, 'w500')}
							alt="Poster for {data.item.title}"
							class={`aspect-[2/3] rounded-xl border border-white/10 object-cover shadow-2xl shadow-black/30 ${
								hasSecondaryVisual ? 'w-full' : 'w-36 sm:w-56'
							}`}
						/>
					{/if}

					{#if data.trailer_url}
						<div class={data.item.poster ? 'relative min-h-0 overflow-hidden' : 'aspect-video'}>
							<TrailerDialog
								url={data.trailer_url}
								title={data.item.title}
								variant="feature"
								fill={Boolean(data.item.poster)}
							/>
						</div>
					{:else if data.item.backdrop}
						<div
							class={`relative overflow-hidden rounded-xl border border-white/10 bg-base-900 shadow-2xl shadow-black/20 ${data.item.poster ? 'min-h-0' : 'aspect-video'}`}
						>
							<img
								src={backdropUrl(data.item.backdrop)}
								alt="Still from {data.item.title}"
								class={data.item.poster
									? 'absolute inset-0 size-full object-cover'
									: 'size-full object-cover'}
							/>
						</div>
					{/if}
				</div>
			{/if}

			<header
				class="mt-6 sm:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[auto_auto] lg:gap-x-8"
			>
				<div
					class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-base-300 sm:text-sm lg:col-start-1 lg:row-start-1"
				>
					<span>{mediaTypeLabel}</span>
					{#each mediaFacts as fact (fact)}
						<span class="text-base-600" aria-hidden="true">•</span>
						<span>{fact}</span>
					{/each}
				</div>

				<div class="hidden shrink-0 lg:col-start-2 lg:row-start-1 lg:block lg:self-center">
					<ExternalRatings
						popfeedScore={data.reviews.length > 0 ? averageReviewRating : null}
						popfeedRatingCount={data.reviews.length}
						imdbId={data.imdb_id}
						imdbVotes={data.imdb_votes}
						ratings={data.ratings}
					/>
				</div>

				<h1
					class="mt-1 max-w-2xl min-w-0 text-3xl leading-tight font-semibold tracking-tight text-white sm:text-5xl lg:col-start-1 lg:row-start-2"
				>
					{data.item.title}
				</h1>

				<div
					class="hidden shrink-0 lg:col-start-2 lg:row-start-2 lg:flex lg:items-center lg:justify-end lg:justify-self-end"
				>
					{@render reviewButton()}
				</div>
			</header>

			<div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 sm:mt-6 lg:hidden">
				<ExternalRatings
					popfeedScore={data.reviews.length > 0 ? averageReviewRating : null}
					popfeedRatingCount={data.reviews.length}
					imdbId={data.imdb_id}
					imdbVotes={data.imdb_votes}
					ratings={data.ratings}
				/>
				<div class="ml-auto">
					{@render reviewButton()}
				</div>
			</div>

			{#if data.item.overview}
				<section class="mt-6 border-t border-white/10 pt-6 text-sm text-white">
					<h2 class="text-lg font-semibold tracking-tight">Overview</h2>
					<p class="mt-4 max-w-3xl leading-6 text-base-200 sm:text-base sm:leading-7">
						{data.item.overview}
					</p>
				</section>
			{/if}

			{#if writtenReviews.length > 0}
				<section class="mt-10 border-t border-white/10 pt-6 text-sm text-white">
					<h2 class="text-lg font-semibold tracking-tight">Reviews</h2>
					<div class="mt-4 flex max-w-2xl flex-col gap-4">
						{#each displayedReviews as review (review.uri)}
							<Review {review} showItem={false} />
						{/each}
					</div>

					{#if !showAllReviews && writtenReviews.length > 3}
						<button
							type="button"
							onclick={() => (showAllReviews = true)}
							class="mt-5 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
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
					<div class="lg:hidden">
						<ItemsGrid items={mobileRecommendations} class="mt-4" />
					</div>
					<div class="hidden lg:block">
						<ItemsGrid items={desktopRecommendations} class="mt-4" />
					</div>

					{#if !showAllRecommendations && data.recommendations.length > 10}
						<button
							type="button"
							onclick={() => (showAllRecommendations = true)}
							class="mt-5 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
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
					{:else if !showAllRecommendations && data.recommendations.length > 6}
						<button
							type="button"
							onclick={() => (showAllRecommendations = true)}
							class="mt-5 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 lg:hidden"
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
				<section class="mt-10 border-t border-white/10 pt-6 pb-8 text-sm text-white">
					<h2 class="text-lg font-semibold tracking-tight">Cast</h2>
					<div class="mt-4 grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-5">
						{#each data.cast as castMember (castMember.id)}
							<a
								href={resolve('/cast/[id]', {
									id: `${castMember.id}-${slugify(castMember.name)}`
								})}
								class="flex min-w-0 flex-col items-center gap-1.5 transition-opacity hover:opacity-75"
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
				</section>
			{/if}
		</div>
	</Container>
</main>
