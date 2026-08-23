<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import Container from '$lib/components/Container.svelte';
	import MediaCollection from '$lib/components/MediaCollection.svelte';
	import Review from '$lib/components/Review.svelte';
	import SearchCommand from '$lib/components/SearchCommand.svelte';
	import TrendingCarousel from '$lib/components/TrendingCarousel.svelte';
	import type { ReviewFeedPage } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let collections = $derived(
		[
			{ title: 'Popular movies', items: data.popularMovies },
			{ title: 'In theaters', items: data.currentlyInTheaters },
			{ title: 'Popular shows', items: data.popularShows }
		].filter((collection) => collection.items.length > 0)
	);
	// These are local snapshots because subsequent pages are appended in the browser.
	// svelte-ignore state_referenced_locally
	let reviews = $state([...data.recentReviews.reviews]);
	// svelte-ignore state_referenced_locally
	let cursor = $state<string | null>(data.recentReviews.cursor);
	const LOAD_AHEAD_PX = 600;
	let loading = $state(false);
	let loadError = $state('');

	async function loadMore() {
		if (loading || !cursor) return;

		const requestedCursor = cursor;
		loading = true;
		loadError = '';

		try {
			const query = new URLSearchParams({ cursor: requestedCursor });
			const response = await fetch(`${resolve('/api/reviews')}?${query}`);
			if (!response.ok) throw new Error('Could not load more reviews.');

			const page = (await response.json()) as ReviewFeedPage;
			const loadedUris = new Set(reviews.map((review) => review.uri));
			reviews = [...reviews, ...page.reviews.filter((review) => !loadedUris.has(review.uri))];
			cursor = page.cursor === requestedCursor ? null : page.cursor;
		} catch (cause) {
			loadError = cause instanceof Error ? cause.message : 'Could not load more reviews.';
		} finally {
			loading = false;
		}

		await tick();
		const distanceFromBottom =
			document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
		if (!loadError && cursor && distanceFromBottom < LOAD_AHEAD_PX) void loadMore();
	}

	function loadWhenNear(node: HTMLElement) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void loadMore();
			},
			{ rootMargin: `${LOAD_AHEAD_PX}px 0px` }
		);
		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

<svelte:head>
	<title>Search movies and TV | atmo.watch</title>
	<meta name="description" content="Find a movie or TV show to review." />
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<h1 class="sr-only">Search movies and TV shows</h1>

	{#if data.trending.length > 0}
		<TrendingCarousel items={data.trending} />
	{/if}

	<Container class="px-4">
		<div
			class={`mx-auto w-full max-w-xl ${data.trending.length > 0 ? 'mt-8' : 'pt-[18vh] sm:pt-[22vh]'}`}
		>
			<SearchCommand did={data.did} />
		</div>

		{#if collections.length > 0 || reviews.length > 0 || cursor}
			<div class={`${data.trending.length > 0 ? 'mt-12' : 'mt-20'} pb-12`}>
				{#if collections.length > 0}
					<div class="space-y-12">
						{#each collections as collection, index (collection.title)}
							<MediaCollection
								title={collection.title}
								items={collection.items}
								class={index > 0 ? 'border-t border-white/10 pt-8' : undefined}
							/>
						{/each}
					</div>
				{/if}

				{#if reviews.length > 0 || cursor}
					<section
						class={`w-full text-sm text-white ${collections.length > 0 ? 'mt-12 border-t border-white/10 pt-8' : ''}`}
					>
						<h2 class="text-lg font-semibold tracking-tight">
							Recently reviewed in the atmosphere
						</h2>

						{#if reviews.length > 0}
							<div class="mt-4 flex flex-col gap-4">
								{#each reviews as review (review.uri)}
									<Review {review} viewerDid={data.did} class="px-0 sm:px-0" />
								{/each}
							</div>
						{/if}

						{#if cursor}
							<div
								use:loadWhenNear
								class="flex min-h-16 items-center justify-center pt-4 text-xs text-base-400"
								aria-live="polite"
							>
								{#if loading}
									<span class="animate-pulse">Loading more reviews…</span>
								{:else if loadError}
									<span class="inline-flex items-center gap-3">
										{loadError}
										<button
											type="button"
											onclick={loadMore}
											class="font-semibold text-white underline underline-offset-4 hover:text-accent-300"
										>
											Try again
										</button>
									</span>
								{:else}
									<span class="sr-only">More reviews load as you scroll.</span>
								{/if}
							</div>
						{/if}
					</section>
				{/if}
			</div>
		{:else if data.trending.length === 0}
			<p class="mt-20 pb-12 text-sm text-base-400">
				No movies, shows, or reviews are available right now.
			</p>
		{/if}
	</Container>
</main>
