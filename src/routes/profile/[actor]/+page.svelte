<script lang="ts">
	import { resolve } from '$app/paths';
	import { UserProfile } from '@foxui/social';
	import { untrack } from 'svelte';
	import Container from '$lib/components/Container.svelte';
	import ItemCard from '$lib/components/ItemCard.svelte';
	import ListCard from '$lib/components/ListCard.svelte';
	import Review from '$lib/components/Review.svelte';
	import type { ReviewFeedPage } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let showAllReviews = $state(false);
	let showAllRatings = $state(false);
	// These are local snapshots because subsequent profile pages are appended in the browser.
	// svelte-ignore state_referenced_locally
	let reviews = $state([...data.reviews]);
	// svelte-ignore state_referenced_locally
	let cursor = $state<string | null>(data.reviewCursor);
	let loadingMore = $state(false);
	let loadError = $state('');
	let loadedReviewPages = $state(false);
	// svelte-ignore state_referenced_locally
	let activeProfileDid = $state(data.profile.did);
	let ratings = $derived(reviews.filter((review) => !review.text.trim()));
	let writtenReviews = $derived(reviews.filter((review) => review.text.trim()));
	let displayedReviews = $derived(showAllReviews ? writtenReviews : writtenReviews.slice(0, 3));
	let mobileRatings = $derived(showAllRatings ? ratings : ratings.slice(0, 6));
	let desktopRatings = $derived(showAllRatings ? ratings : ratings.slice(0, 10));

	async function loadMore() {
		if (!cursor || loadingMore) return;

		const requestedCursor = cursor;
		loadingMore = true;
		loadError = '';
		try {
			const query = new URLSearchParams({ actor: data.profile.did, cursor: requestedCursor });
			const response = await fetch(`${resolve('/api/reviews/profile')}?${query}`);
			if (!response.ok) throw new Error('Could not load more reviews.');

			const page = (await response.json()) as ReviewFeedPage;
			const loadedUris = new Set(reviews.map((review) => review.uri));
			reviews = [...reviews, ...page.reviews.filter((review) => !loadedUris.has(review.uri))];
			cursor = page.cursor === requestedCursor ? null : page.cursor;
			loadedReviewPages = true;
			showAllReviews = true;
			showAllRatings = true;
		} catch (cause) {
			loadError = cause instanceof Error ? cause.message : 'Could not load more reviews.';
		} finally {
			loadingMore = false;
		}
	}

	$effect(() => {
		const nextProfileDid = data.profile.did;
		const serverReviews = data.reviews;
		const serverCursor = data.reviewCursor;
		if (nextProfileDid !== activeProfileDid) {
			activeProfileDid = nextProfileDid;
			reviews = [...serverReviews];
			cursor = serverCursor;
			loadedReviewPages = false;
			showAllReviews = false;
			showAllRatings = false;
			loadError = '';
			return;
		}

		const currentReviews = untrack(() => reviews);
		const refreshedUris = new Set(serverReviews.map((review) => review.uri));
		reviews = [
			...serverReviews,
			...currentReviews.filter((review) => !refreshedUris.has(review.uri))
		];
		if (!untrack(() => loadedReviewPages)) cursor = serverCursor;
	});
</script>

<svelte:head>
	<title>@{data.profile.handle} | atmo.watch</title>
	<meta name="description" content={`Movie and TV reviews and lists by @${data.profile.handle}.`} />
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<Container class="px-4 sm:pt-8">
		<UserProfile
			class="not-prose -mx-4 w-[calc(100%+2rem)] max-w-none sm:mx-auto sm:w-auto sm:max-w-2xl sm:pb-0 [&>div:last-child]:hidden"
			profile={{
				handle: `@${data.profile.handle}`,
				displayName: data.profile.displayName,
				avatar: data.profile.avatarUrl,
				banner: data.profile.bannerUrl
			}}
		/>

		{#if writtenReviews.length > 0 || ratings.length > 0 || cursor || data.lists.length > 0}
			<div class="mx-auto max-w-2xl">
				{#if writtenReviews.length > 0}
					<section class="mt-6 text-sm text-white">
						<h2 class="text-lg font-semibold tracking-tight">Reviews</h2>
						<div class="mt-4 flex flex-col gap-4">
							{#each displayedReviews as review (review.uri)}
								<Review {review} viewerDid={data.did} class="px-0 sm:px-0" />
							{/each}
						</div>

						{#if !showAllReviews && writtenReviews.length > 3}
							<button
								type="button"
								onclick={() => (showAllReviews = true)}
								class="mt-5 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
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

				{#if ratings.length > 0}
					<section
						class={`text-sm text-white ${writtenReviews.length > 0 ? 'mt-10 border-t border-white/10 pt-6' : 'mt-6'}`}
					>
						<h2 class="text-lg font-semibold tracking-tight">Ratings</h2>
						<div class="mt-4 grid grid-cols-3 gap-4 lg:hidden">
							{#each mobileRatings as review (review.uri)}
								<ItemCard item={review.media} showTitle={false} rating={review.rating} />
							{/each}
						</div>
						<div class="mt-4 hidden grid-cols-5 gap-4 lg:grid">
							{#each desktopRatings as review (review.uri)}
								<ItemCard item={review.media} showTitle={false} rating={review.rating} />
							{/each}
						</div>

						{#if !showAllRatings && ratings.length > 6}
							<button
								type="button"
								onclick={() => (showAllRatings = true)}
								class={`mt-5 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${ratings.length <= 10 ? 'lg:hidden' : ''}`}
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

				{#if cursor || loadError}
					<div
						class={`flex items-center gap-3 ${writtenReviews.length > 0 || ratings.length > 0 ? 'mt-8' : 'mt-6'}`}
					>
						{#if cursor}
							<button
								type="button"
								onclick={loadMore}
								disabled={loadingMore}
								class="inline-flex h-8 items-center rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:cursor-wait disabled:opacity-60"
							>
								{loadingMore ? 'loading…' : 'load more ratings & reviews'}
							</button>
						{/if}
						{#if loadError}
							<span class="text-xs text-red-300" role="status">{loadError}</span>
						{/if}
					</div>
				{/if}

				{#if data.lists.length > 0}
					<section
						class={`text-sm text-white ${writtenReviews.length > 0 || ratings.length > 0 ? 'mt-10 border-t border-white/10 pt-6' : 'mt-6'}`}
					>
						<h2 class="text-lg font-semibold tracking-tight">Lists</h2>
						<div class="mt-4 grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2">
							{#each data.lists as list (list.uri)}
								<ListCard {list} />
							{/each}
						</div>
					</section>
				{/if}
			</div>
		{:else}
			<p class="mx-auto max-w-2xl pt-8 text-sm text-base-400">No reviews, ratings, or lists yet.</p>
		{/if}
	</Container>
</main>
