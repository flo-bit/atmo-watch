<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Shuffle } from '@lucide/svelte';
	import Container from '$lib/components/Container.svelte';
	import VideoGallery from '$lib/components/VideoGallery.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let shuffling = $state(false);

	async function shuffleVideos() {
		if (shuffling) return;
		shuffling = true;
		try {
			await invalidateAll();
		} finally {
			shuffling = false;
		}
	}
</script>

<svelte:head>
	<title>Random videos | atmo.watch</title>
	<meta
		name="description"
		content="Discover random trailers, scenes, interviews, reviews, and other videos submitted to atmo.watch."
	/>
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<Container class="px-4 pt-12 pb-16 sm:pt-16">
		<header class="flex max-w-3xl items-end justify-between gap-5">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Random videos</h1>
				<p class="mt-2 text-sm leading-6 text-base-400">
					Trailers, scenes, interviews, reviews, and more from around the atmosphere.
				</p>
			</div>
			<button
				type="button"
				onclick={shuffleVideos}
				disabled={shuffling}
				class="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:cursor-wait disabled:opacity-50"
			>
				<Shuffle
					class={`size-3.5 ${shuffling ? 'animate-spin' : ''}`}
					strokeWidth={1.8}
					aria-hidden="true"
				/>
				{shuffling ? 'shuffling…' : 'shuffle'}
			</button>
		</header>

		{#if data.videos.length > 0}
			<VideoGallery videos={data.videos} title="random videos" layout="grid" />
		{:else}
			<p
				class="mt-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-base-400"
			>
				No videos have been submitted yet.
			</p>
		{/if}
	</Container>
</main>
