<script lang="ts">
	import Avatar from '$lib/components/Avatar.svelte';
	import Container from '$lib/components/Container.svelte';
	import ItemCard from '$lib/components/ItemCard.svelte';
	import Review from '$lib/components/Review.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let ratings = $derived(data.reviews.filter((review) => !review.text.trim()));
	let writtenReviews = $derived(data.reviews.filter((review) => review.text.trim()));
</script>

<svelte:head>
	<title>@{data.profile.handle} reviews | atmo.watch</title>
	<meta name="description" content={`Movie and TV reviews by @${data.profile.handle}.`} />
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<Container class="px-4 pt-12">
		<header class="flex items-center gap-4 border-b border-base-800 pb-8 sm:gap-6">
			<Avatar
				src={data.profile.avatarUrl}
				alt={`@${data.profile.handle}'s Bluesky avatar`}
				class="size-20 shrink-0 sm:size-24"
			/>
			<h1 class="min-w-0 truncate text-xl font-semibold text-white sm:text-2xl">
				@{data.profile.handle}
			</h1>
		</header>

		{#if ratings.length > 0}
			<section class="pt-8" aria-labelledby="ratings-heading">
				<h2 id="ratings-heading" class="text-lg font-semibold text-white">ratings</h2>
				<div class="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-3 lg:grid-cols-5">
					{#each ratings as review (review.uri)}
						<ItemCard item={review.media} showTitle={false} rating={review.rating} />
					{/each}
				</div>
			</section>
		{/if}

		{#if writtenReviews.length > 0}
			<section class="pt-10" aria-labelledby="reviews-heading">
				<h2 id="reviews-heading" class="text-lg font-semibold text-white">reviews</h2>
				<div class="mt-6 flex max-w-2xl flex-col gap-4">
					{#each writtenReviews as review (review.uri)}
						<Review {review} />
					{/each}
				</div>
			</section>
		{/if}

		{#if data.reviews.length === 0}
			<section class="pt-8" aria-labelledby="reviews-heading">
				<h2 id="reviews-heading" class="text-lg font-semibold text-white">reviews</h2>
				<p class="mt-4 text-sm text-base-400">No movie or TV reviews yet.</p>
			</section>
		{/if}
	</Container>
</main>
