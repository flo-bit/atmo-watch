<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { Play, X } from '@lucide/svelte';
	import type { MediaVideo } from '$lib/types';
	import HorizontalScroller from './HorizontalScroller.svelte';

	let { videos, title }: { videos: readonly MediaVideo[]; title: string } = $props();
	let open = $state(false);
	let selectedVideo = $state<MediaVideo | null>(null);
	let showAllVideos = $state(false);
	let fallbackKeys = $state<string[]>([]);
	let embedUrl = $derived(
		selectedVideo
			? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(selectedVideo.key)}?autoplay=1&playsinline=1&rel=0`
			: null
	);

	function thumbnailUrl(video: MediaVideo) {
		return `https://i.ytimg.com/vi/${encodeURIComponent(video.key)}/${fallbackKeys.includes(video.key) ? 'hqdefault' : 'maxresdefault'}.jpg`;
	}

	function useFallback(video: MediaVideo) {
		if (!fallbackKeys.includes(video.key)) fallbackKeys = [...fallbackKeys, video.key];
	}

	function play(video: MediaVideo) {
		selectedVideo = video;
		open = true;
	}

	function handleOpenChange(nextOpen: boolean) {
		open = nextOpen;
		if (!nextOpen) selectedVideo = null;
	}

	$effect(() => {
		if (title) showAllVideos = false;
	});
</script>

<HorizontalScroller
	class="mt-4 gap-3 pb-3 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0"
	label={`Videos for ${title}`}
>
	{#each videos as video, index (video.id)}
		<button
			type="button"
			onclick={() => play(video)}
			class={`group w-[82vw] max-w-sm shrink-0 snap-start text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70 lg:w-auto lg:max-w-none ${!showAllVideos && index >= 2 ? 'lg:hidden' : ''}`}
			aria-label={`Play ${video.name}`}
		>
			<span
				class="relative block aspect-video overflow-hidden rounded-xl border border-white/10 bg-base-900 shadow-lg shadow-black/20"
			>
				<img
					src={thumbnailUrl(video)}
					alt=""
					loading="lazy"
					onerror={() => useFallback(video)}
					class="size-full object-cover transition duration-300 group-hover:scale-[1.015] group-hover:opacity-85 motion-reduce:transition-none"
				/>
				<span class="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/5"
				></span>
				<span
					class="absolute top-1/2 left-1/2 inline-flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-black shadow-xl transition-transform group-hover:scale-105"
				>
					<Play class="ml-0.5 size-5" fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
				</span>
				<span
					class="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[0.625rem] font-semibold tracking-wide text-white uppercase backdrop-blur-sm"
				>
					{video.type}
				</span>
			</span>
			<span class="mt-2 line-clamp-2 block text-sm font-semibold text-white">{video.name}</span>
		</button>
	{/each}
</HorizontalScroller>

{#if !showAllVideos && videos.length > 2}
	<button
		type="button"
		onclick={() => (showAllVideos = true)}
		class="mt-5 hidden h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 lg:inline-flex"
	>
		show more videos
		<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m6 9 6 6 6-6" />
		</svg>
	</button>
{/if}

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	{#if selectedVideo && embedUrl}
		<Dialog.Portal>
			<Dialog.Overlay class="fixed inset-0 z-100 bg-black/80 backdrop-blur-md" />
			<Dialog.Content
				class="fixed top-1/2 left-1/2 z-101 aspect-video w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-visible rounded-xl outline-none"
			>
				<Dialog.Title class="sr-only">{selectedVideo.name}</Dialog.Title>
				<Dialog.Description class="sr-only">
					YouTube video for {title}. Press Escape or click outside the player to close.
				</Dialog.Description>

				<div
					class="size-full overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl"
				>
					<iframe
						src={embedUrl}
						title={selectedVideo.name}
						class="size-full border-0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
						referrerpolicy="strict-origin-when-cross-origin"
						allowfullscreen
					></iframe>
				</div>

				<Dialog.Close
					class="absolute -top-12 right-0 inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
				>
					<X class="size-5" strokeWidth={1.8} aria-hidden="true" />
					<span class="sr-only">Close video</span>
				</Dialog.Close>
			</Dialog.Content>
		</Dialog.Portal>
	{/if}
</Dialog.Root>
