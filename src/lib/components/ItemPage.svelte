<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Dialog } from 'bits-ui';
	import { Plus, X } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import AddToListMenu from './AddToListMenu.svelte';
	import Avatar from './Avatar.svelte';
	import BackdropGallery from './BackdropGallery.svelte';
	import Container from './Container.svelte';
	import ExternalRatings from './ExternalRatings.svelte';
	import HorizontalScroller from './HorizontalScroller.svelte';
	import ItemCard from './ItemCard.svelte';
	import ItemsGrid from './ItemsGrid.svelte';
	import MediaHero from './MediaHero.svelte';
	import Review from './Review.svelte';
	import TrailerDialog from './TrailerDialog.svelte';
	import TvScheduleCard from './TvScheduleCard.svelte';
	import TvSeasons from './TvSeasons.svelte';
	import VideoGallery from './VideoGallery.svelte';
	import WatchedButton from './WatchedButton.svelte';
	import { backdropUrl, posterUrl, profileUrl } from '$lib/images';
	import { loadMediaListState, type MediaListState } from '$lib/list-write.remote';
	import { loginDialog } from '$lib/login.svelte';
	import { reviewDialog } from '$lib/review.svelte';
	import { slugify, toMediaRouteKind } from '$lib/utils';
	import { videoDialog } from '$lib/video.svelte';
	import type { getMediaPage } from '$lib/tmdb.server';
	import type { ReviewCardModel, ReviewFeedPage } from '$lib/types';

	type ItemPageData = Awaited<ReturnType<typeof getMediaPage>> & {
		did: string | null;
		reviews: ReviewCardModel[];
		reviewCursor: string | null;
		ratingSummary: { score: number | null; count: number };
		today: string;
	};

	function startReview() {
		if (!data.did) {
			loginDialog.show();
			return;
		}

		reviewDialog.show(data.item);
	}

	function startVideoSubmission() {
		if (!data.did) {
			loginDialog.show();
			return;
		}

		videoDialog.show(data.item);
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
	let ogImageUrl = $derived(
		`${canonicalUrl.replace(/\/$/, '')}/og.png?v=${encodeURIComponent(data.artworkRevision ?? '4')}`
	);
	let tmdbUrl = $derived(
		`https://www.themoviedb.org/${data.item.creativeWorkType === 'tv_show' ? 'tv' : 'movie'}/${data.item.tmdbId}`
	);
	let videosPageUrl = $derived(
		resolve('/[kind]/[id]/videos', {
			kind: toMediaRouteKind(data.item.creativeWorkType),
			id: `${data.item.tmdbId}-${slugify(data.item.title)}`
		})
	);
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
	// These are local snapshots because subsequent review pages are appended in the browser.
	// svelte-ignore state_referenced_locally
	let reviews = $state([...data.reviews]);
	// svelte-ignore state_referenced_locally
	let reviewCursor = $state<string | null>(data.reviewCursor);
	let reviewsLoading = $state(false);
	let reviewsError = $state('');
	let loadedReviewPages = $state(false);
	let listState = $state<MediaListState | null>(null);
	let listStateLoading = $state(false);
	let listStateError = $state('');
	let listStateRequest = 0;
	// svelte-ignore state_referenced_locally
	let activeMediaKey = $state(`${data.item.creativeWorkType}:${data.item.tmdbId}`);
	let showAllReviews = $state(false);
	let selectedReview = $state<ReviewCardModel | null>(null);
	let reviewPopupOpen = $state(false);
	let showAllRecommendations = $state(false);
	let showAllCast = $state(false);
	let writtenReviews = $derived(reviews.filter((review) => review.text.trim()));
	let displayedReviews = $derived(showAllReviews ? writtenReviews : writtenReviews.slice(0, 3));
	let desktopRecommendations = $derived(
		showAllRecommendations ? data.recommendations : data.recommendations.slice(0, 5)
	);
	async function refreshListState() {
		if (!data.did) {
			listState = null;
			listStateLoading = false;
			listStateError = '';
			return;
		}

		const requestId = ++listStateRequest;
		listStateLoading = true;
		listStateError = '';
		try {
			const state = await loadMediaListState({
				creativeWorkType: data.item.creativeWorkType,
				tmdbId: data.item.tmdbId
			});
			if (requestId === listStateRequest) listState = state;
		} catch (cause) {
			if (requestId === listStateRequest) {
				listStateError = cause instanceof Error ? cause.message : 'Could not load your lists.';
			}
		} finally {
			if (requestId === listStateRequest) listStateLoading = false;
		}
	}

	async function loadMoreReviews() {
		if (!reviewCursor || reviewsLoading) return;

		const requestedCursor = reviewCursor;
		reviewsLoading = true;
		reviewsError = '';
		try {
			const query = new URLSearchParams({
				tmdbId: String(data.item.tmdbId),
				type: data.item.creativeWorkType,
				cursor: requestedCursor
			});
			const response = await fetch(`${resolve('/api/reviews/media')}?${query}`);
			if (!response.ok) throw new Error('Could not load more reviews.');

			const page = (await response.json()) as ReviewFeedPage;
			const loadedUris = new Set(reviews.map((review) => review.uri));
			reviews = [...reviews, ...page.reviews.filter((review) => !loadedUris.has(review.uri))];
			reviewCursor = page.cursor === requestedCursor ? null : page.cursor;
			loadedReviewPages = true;
			showAllReviews = true;
		} catch (cause) {
			reviewsError = cause instanceof Error ? cause.message : 'Could not load more reviews.';
		} finally {
			reviewsLoading = false;
		}
	}

	async function revealOrLoadReviews() {
		if (!showAllReviews) {
			showAllReviews = true;
			if (writtenReviews.length > 3) return;
		}
		await loadMoreReviews();
	}

	function showFullReview(review: ReviewCardModel) {
		selectedReview = review;
		reviewPopupOpen = true;
	}

	function handleReviewPopupOpenChange(open: boolean) {
		reviewPopupOpen = open;
		if (!open) selectedReview = null;
	}

	$effect(() => {
		const nextMediaKey = `${data.item.creativeWorkType}:${data.item.tmdbId}`;
		const did = data.did;
		const serverReviews = data.reviews;
		const serverCursor = data.reviewCursor;
		if (nextMediaKey !== activeMediaKey) {
			activeMediaKey = nextMediaKey;
			reviews = [...serverReviews];
			reviewCursor = serverCursor;
			loadedReviewPages = false;
			reviewsError = '';
			showAllReviews = false;
			reviewPopupOpen = false;
			selectedReview = null;
			showAllRecommendations = false;
			showAllCast = false;
		} else {
			const currentReviews = untrack(() => reviews);
			const refreshedUris = new Set(serverReviews.map((review) => review.uri));
			reviews = [
				...serverReviews,
				...currentReviews.filter((review) => !refreshedUris.has(review.uri))
			];
			if (!untrack(() => loadedReviewPages)) reviewCursor = serverCursor;
		}

		if (!did) {
			listState = null;
			listStateLoading = false;
			listStateError = '';
			return;
		}
		void untrack(refreshListState);
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

	<section class="relative isolate z-10 overflow-hidden">
		<MediaHero
			title={data.item.title}
			backdrop={data.item.backdrop}
			fallbackPoster={data.item.poster}
			logo={data.logo}
		/>

		<div class="mx-auto w-full max-w-4xl px-4 sm:px-8 md:pl-24 lg:px-8">
			<div class="mx-auto max-w-3xl min-w-0 text-center">
				<div
					class="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-xs font-medium text-base-200 lg:text-sm"
				>
					{#each mediaFacts as fact, index (fact)}
						{#if index > 0}
							<span class="text-base-500" aria-hidden="true">•</span>
						{/if}
						<span>{fact}</span>
					{/each}
				</div>

				<div class="mt-4 flex justify-center lg:mt-3">
					<ExternalRatings
						popfeedScore={data.ratingSummary.score}
						popfeedRatingCount={data.ratingSummary.count}
						imdbId={data.imdb_id}
						imdbVotes={data.imdb_votes}
						ratings={data.ratings}
						tmdbScore={data.item.tmdbScore}
						tmdbRatingCount={data.item.tmdbRatingCount}
						{tmdbUrl}
					/>
				</div>

				<div class="mt-8 flex flex-col items-center lg:mt-5 lg:flex-row lg:justify-center lg:gap-3">
					<div class="flex w-full justify-center lg:w-auto">
						{@render reviewButton()}
					</div>

					<div
						class={`mt-2 grid w-full max-w-md ${data.trailer_url ? 'grid-cols-3' : 'grid-cols-2'} gap-1 lg:mt-0 lg:flex lg:w-auto lg:gap-2`}
					>
						<AddToListMenu
							item={data.item}
							did={data.did}
							variant="action"
							state={listState}
							loading={listStateLoading}
							stateError={listStateError}
							onStateChange={(nextState) => (listState = nextState)}
							onRefresh={refreshListState}
						/>
						{#if data.trailer_url}
							<TrailerDialog url={data.trailer_url} title={data.item.title} variant="action" />
						{/if}
						<WatchedButton
							item={data.item}
							did={data.did}
							state={listState}
							loading={listStateLoading}
							stateError={listStateError}
							onStateChange={(nextState) => (listState = nextState)}
						/>
					</div>
				</div>

				{#if data.item.overview}
					<div class="mt-7 hidden max-w-3xl text-left lg:mt-5 lg:block">
						<p class="text-sm leading-6 text-base-100">{data.item.overview}</p>
					</div>
				{/if}
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

			{#if writtenReviews.length > 0 || reviewCursor}
				<section class="mt-10 border-t border-white/10 pt-6 text-sm text-white">
					<h2 class="text-lg font-semibold tracking-tight">Reviews</h2>
					{#if writtenReviews.length > 0}
						<HorizontalScroller class="mt-4 items-stretch gap-3 pb-3 lg:hidden" label="Reviews">
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
						</HorizontalScroller>
					{/if}
					<div class="mt-4 hidden grid-cols-3 items-stretch gap-3 lg:grid">
						{#each displayedReviews as review (review.uri)}
							<Review
								{review}
								viewerDid={data.did}
								showItem={false}
								compact={true}
								onOpen={() => showFullReview(review)}
								class="rounded-xl border border-white/10 bg-black/25 backdrop-blur-xl"
							/>
						{/each}
					</div>

					{#if reviewCursor}
						<button
							type="button"
							onclick={loadMoreReviews}
							disabled={reviewsLoading}
							class="mt-4 inline-flex h-8 items-center rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:cursor-wait disabled:opacity-60 lg:hidden"
						>
							{reviewsLoading ? 'loading…' : 'load more reviews'}
						</button>
					{/if}

					{#if (!showAllReviews && writtenReviews.length > 3) || reviewCursor}
						<button
							type="button"
							onclick={revealOrLoadReviews}
							disabled={reviewsLoading}
							class="mt-5 hidden h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:cursor-wait disabled:opacity-60 lg:inline-flex"
						>
							{reviewsLoading
								? 'loading…'
								: !showAllReviews && writtenReviews.length > 3
									? 'see more reviews'
									: 'load more reviews'}
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

					{#if reviewsError}
						<p class="mt-3 text-xs text-red-300" role="status">{reviewsError}</p>
					{/if}
				</section>
			{/if}

			<section class="mt-10 border-t border-white/10 pt-6 text-sm text-white">
				<div class="flex items-center justify-between gap-4">
					<h2 class="text-lg font-semibold tracking-tight">Videos</h2>
					<button
						type="button"
						onclick={startVideoSubmission}
						class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
					>
						<Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
						submit video
					</button>
				</div>
				{#if data.videos.length > 0}
					<VideoGallery videos={data.videos.slice(0, 3)} title={data.item.title} />
					{#if data.videos.length > 3}
						<a
							href={videosPageUrl}
							class="mt-5 inline-flex h-8 items-center rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
						>
							see more
						</a>
					{/if}
				{:else}
					<p class="mt-4 text-sm text-base-400">No videos have been added yet.</p>
				{/if}
			</section>

			{#if data.recommendations.length > 0}
				<section class="mt-10 border-t border-white/10 pt-6 text-sm text-white">
					<h2 class="text-lg font-semibold tracking-tight">Similar</h2>
					<HorizontalScroller class="mt-4 gap-3 pb-3 lg:hidden" label="Similar titles">
						{#each data.recommendations as item (`${item.creativeWorkType}:${item.tmdbId}`)}
							<div class="w-32 shrink-0 snap-start sm:w-36">
								<ItemCard {item} />
							</div>
						{/each}
					</HorizontalScroller>
					<div class="hidden lg:block">
						<ItemsGrid items={desktopRecommendations} class="mt-4" />
					</div>

					{#if !showAllRecommendations && data.recommendations.length > 5}
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
					<HorizontalScroller
						class="mt-4 gap-4 pb-3 lg:grid lg:grid-cols-5 lg:gap-x-4 lg:gap-y-6 lg:overflow-visible lg:pb-0"
						label="Cast"
					>
						{#each data.cast as castMember, index (castMember.creditId)}
							<a
								href={resolve('/cast/[id]', {
									id: `${castMember.id}-${slugify(castMember.name)}`
								})}
								class={`flex w-24 min-w-0 shrink-0 snap-start flex-col items-center gap-1.5 transition-opacity hover:opacity-75 sm:w-28 lg:w-auto ${showAllCast || index < 5 ? 'lg:flex' : 'lg:hidden'}`}
							>
								<Avatar
									src={profileUrl(castMember.profile_path, 'h632')}
									alt={castMember.name}
									shape="rounded"
									class="aspect-4/5 w-full"
								/>
								<span class="line-clamp-2 text-center text-xs font-medium">{castMember.name}</span>
								<span class="line-clamp-2 text-center text-xs text-base-400"
									>{castMember.character}</span
								>
							</a>
						{/each}
					</HorizontalScroller>

					{#if !showAllCast && data.cast.length > 5}
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
					<Review
						review={selectedReview}
						viewerDid={data.did}
						showItem={false}
						revealSpoilers={true}
						class="py-0"
					/>
				</div>
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{/if}
