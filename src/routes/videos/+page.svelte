<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import Container from '$lib/components/Container.svelte';
	import VideoGallery from '$lib/components/VideoGallery.svelte';
	import type { SubmittedVideoFeedPage } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	// These are local snapshots because subsequent pages are appended in the browser.
	// svelte-ignore state_referenced_locally
	let videos = $state([...data.recentVideos.videos]);
	// svelte-ignore state_referenced_locally
	let cursor = $state<string | null>(data.recentVideos.cursor);
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
			const response = await fetch(`${resolve('/api/videos')}?${query}`);
			if (!response.ok) throw new Error('Could not load more videos.');

			const page = (await response.json()) as SubmittedVideoFeedPage;
			const loadedUris = new Set(videos.map((video) => video.id));
			videos = [...videos, ...page.videos.filter((video) => !loadedUris.has(video.id))];
			cursor = page.cursor === requestedCursor ? null : page.cursor;
		} catch (cause) {
			loadError = cause instanceof Error ? cause.message : 'Could not load more videos.';
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
	<title>Recently submitted videos | atmo.watch</title>
	<meta
		name="description"
		content="Watch recent trailers, scenes, interviews, reviews, and other videos submitted to atmo.watch."
	/>
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<Container class="px-4 pt-12 pb-16 sm:pt-16">
		<header class="max-w-2xl">
			<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Recently submitted videos</h1>
			<p class="mt-2 text-sm leading-6 text-base-400">
				Trailers, scenes, interviews, reviews, and more from around the atmosphere.
			</p>
		</header>

		{#if videos.length > 0}
			<VideoGallery {videos} title="recently submitted videos" layout="grid" />
		{:else}
			<p
				class="mt-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-base-400"
			>
				No videos have been submitted yet.
			</p>
		{/if}

		{#if cursor}
			<div
				use:loadWhenNear
				class="flex min-h-20 items-center justify-center pt-6 text-xs text-base-400"
				aria-live="polite"
			>
				{#if loading}
					<span class="animate-pulse">Loading more videos…</span>
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
					<span class="sr-only">More videos load as you scroll.</span>
				{/if}
			</div>
		{/if}
	</Container>
</main>
