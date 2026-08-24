<script lang="ts">
	import { resolve } from '$app/paths';
	import { Dialog } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import type { MediaVideo } from '$lib/types';
	import HorizontalScroller from './HorizontalScroller.svelte';

	let {
		videos,
		title,
		layout = 'gallery'
	}: { videos: readonly MediaVideo[]; title: string; layout?: 'gallery' | 'grid' } = $props();
	let open = $state(false);
	let selectedVideo = $state<MediaVideo | null>(null);
	let fallbackKeys = $state<string[]>([]);
	let embedUrl = $derived(
		selectedVideo
			? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(selectedVideo.key)}?autoplay=1&playsinline=1&rel=0`
			: null
	);

	function thumbnailUrl(video: MediaVideo) {
		if (video.thumbnailUrl && !fallbackKeys.includes(video.key)) return video.thumbnailUrl;
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
</script>

{#snippet videoThumbnail(video: MediaVideo)}
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
		<span class="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/5"></span>
		{#if video.containsSpoilers}
			<span
				class="absolute top-2 right-2 rounded-full border border-white/10 bg-black/75 px-2 py-1 text-[0.625rem] font-semibold text-white backdrop-blur-sm"
			>
				spoilers
			</span>
		{/if}
		<span
			class="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[0.625rem] font-semibold tracking-wide text-white uppercase backdrop-blur-sm"
		>
			{video.type}
		</span>
	</span>
{/snippet}

<HorizontalScroller
	class={layout === 'grid'
		? 'mt-6 !grid !snap-none grid-cols-1 items-start gap-x-4 gap-y-7 !overflow-visible sm:grid-cols-2 lg:grid-cols-3'
		: 'mt-4 items-start gap-3 pb-3 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0'}
	label={`Videos for ${title}`}
>
	{#each videos as video (video.id)}
		{@const videoPageUrl =
			video.recordAuthor && video.recordKey
				? resolve('/videos/[actor]/[rkey]', {
						actor: video.recordAuthor,
						rkey: video.recordKey
					})
				: null}
		<article
			class={`text-left ${layout === 'grid' ? 'w-full min-w-0' : 'w-[82vw] max-w-sm shrink-0 snap-start lg:w-auto lg:max-w-none'}`}
		>
			{#if videoPageUrl}
				<a
					href={videoPageUrl}
					class="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
					aria-label={`View ${video.name}`}
				>
					{@render videoThumbnail(video)}
				</a>
			{:else}
				<button
					type="button"
					onclick={() => play(video)}
					class="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
					aria-label={`Play ${video.name}`}
				>
					{@render videoThumbnail(video)}
				</button>
			{/if}

			{#if videoPageUrl}
				<a
					href={videoPageUrl}
					class="mt-2 block truncate text-sm font-semibold text-white transition-colors hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
				>
					{video.name}
				</a>
			{:else}
				<span class="mt-2 block truncate text-sm font-semibold text-white">{video.name}</span>
			{/if}
		</article>
	{/each}
</HorizontalScroller>

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
