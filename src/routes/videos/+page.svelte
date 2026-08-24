<script lang="ts">
	import { resolve } from '$app/paths';
	import Container from '$lib/components/Container.svelte';
	import VideoGallery from '$lib/components/VideoGallery.svelte';
	import type { MediaVideo } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	// svelte-ignore state_referenced_locally
	let videos = $state<MediaVideo[]>([...data.videos]);
	let loading = $state(false);
	// svelte-ignore state_referenced_locally
	let hasMore = $state(data.videos.length >= 24);
	let loadError = $state(false);
	let loadMoreTrigger = $state<HTMLDivElement>();
	let duplicateBatches = 0;

	async function loadMore() {
		if (loading || !hasMore) return;
		loading = true;
		loadError = false;

		try {
			const response = await fetch(`${resolve('/api/videos/scenes')}?limit=24`);
			if (!response.ok) throw new Error('Could not load scenes');

			const result = (await response.json()) as { videos: MediaVideo[] };
			const existingIds = new Set(videos.map((video) => video.id));
			const newVideos = result.videos.filter((video) => !existingIds.has(video.id));
			videos = [...videos, ...newVideos];
			duplicateBatches = newVideos.length === 0 ? duplicateBatches + 1 : 0;
			if (result.videos.length < 24 || duplicateBatches >= 3) hasMore = false;
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!loadMoreTrigger || !hasMore) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void loadMore();
			},
			{ rootMargin: '600px 0px' }
		);
		observer.observe(loadMoreTrigger);
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>Random scenes | atmo.watch</title>
	<meta name="description" content="Discover random movie and TV scenes on atmo.watch." />
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<Container class="px-4 pt-4 pb-16 sm:pt-6">
		<h1 class="sr-only">Random scenes</h1>

		{#if videos.length > 0}
			<VideoGallery
				{videos}
				title="random scenes"
				layout="grid"
				showBadges={false}
				showMediaTitles={true}
			/>
			{#if hasMore}
				<div
					bind:this={loadMoreTrigger}
					class="flex min-h-24 items-center justify-center"
					aria-live="polite"
				>
					{#if loading}
						<span class="text-sm text-base-500">Loading more scenes…</span>
					{:else if loadError}
						<button
							type="button"
							onclick={loadMore}
							class="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
						>
							try again
						</button>
					{/if}
				</div>
			{/if}
		{:else}
			<p
				class="mt-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-base-400"
			>
				No scenes have been submitted yet.
			</p>
		{/if}
	</Container>
</main>
