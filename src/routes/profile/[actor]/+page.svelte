<script lang="ts">
	import Avatar from '$lib/components/Avatar.svelte';
	import Container from '$lib/components/Container.svelte';
	import ItemsGrid from '$lib/components/ItemsGrid.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
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

		<section class="pt-8" aria-labelledby="reviews-heading">
			<h2 id="reviews-heading" class="text-lg font-semibold text-white">reviews</h2>

			{#if data.items.length > 0}
				<ItemsGrid items={data.items} />
			{:else}
				<p class="mt-4 text-sm text-base-400">No movie or TV reviews yet.</p>
			{/if}
		</section>
	</Container>
</main>
