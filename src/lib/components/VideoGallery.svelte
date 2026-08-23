<script lang="ts">
	import { resolve } from '$app/paths';
	import { Dialog } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import type { MediaVideo } from '$lib/types';
	import { slugify } from '$lib/utils';
	import HorizontalScroller from './HorizontalScroller.svelte';

	let {
		videos,
		title,
		layout = 'gallery'
	}: { videos: readonly MediaVideo[]; title: string; layout?: 'gallery' | 'grid' } = $props();
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

	$effect(() => {
		if (title) showAllVideos = false;
	});
</script>

<HorizontalScroller
	class={layout === 'grid'
		? 'mt-6 !grid !snap-none grid-cols-1 items-start gap-x-4 gap-y-7 !overflow-visible sm:grid-cols-2 lg:grid-cols-3'
		: 'mt-4 items-start gap-3 pb-3 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0'}
	label={`Videos for ${title}`}
>
	{#each videos as video, index (video.id)}
		{@const context = video.context}
		{@const showTitle = context?.seriesTitle ?? context?.title ?? 'TV series'}
		{@const showTmdbId =
			context?.creativeWorkType === 'tv_show' ? context.tmdbId : context?.tmdbTvSeriesId}
		{@const showId = showTmdbId ? `${showTmdbId}-${slugify(showTitle)}` : null}
		<article
			class={`text-left ${layout === 'grid' ? 'w-full min-w-0' : 'w-[82vw] max-w-sm shrink-0 snap-start lg:w-auto lg:max-w-none'} ${layout === 'gallery' && !showAllVideos && index >= 3 ? 'lg:hidden' : ''}`}
		>
			<button
				type="button"
				onclick={() => play(video)}
				class="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
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
			</button>

			<span class="mt-2 block truncate text-sm font-semibold text-white">{video.name}</span>
			{#if layout === 'grid' && context}
				<div class="mt-1 flex flex-wrap items-center text-xs text-base-400">
					{#if context.creativeWorkType === 'movie'}
						<a
							href={resolve('/[kind]/[id]', {
								kind: 'movie',
								id: `${context.tmdbId}-${slugify(context.title)}`
							})}
							class="transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
						>
							{context.title}
						</a>
					{:else if showId}
						<a
							href={resolve('/[kind]/[id]', { kind: 'tv', id: showId })}
							class="transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
						>
							{showTitle}
						</a>
						{#if context.seasonNumber !== undefined}
							<span class="mx-1.5 text-base-600" aria-hidden="true">·</span>
							<a
								href={resolve('/[kind]/[id]/season/[season]', {
									kind: 'tv',
									id: showId,
									season: String(context.seasonNumber)
								})}
								class="transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
							>
								Season {context.seasonNumber}
							</a>
							{#if context.episodeNumber !== undefined}
								<span>,&nbsp;</span>
								<a
									href={resolve(`/[kind]/[id]/season/[season]#episode-${context.episodeNumber}`, {
										kind: 'tv',
										id: showId,
										season: String(context.seasonNumber)
									})}
									class="transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
								>
									Episode {context.episodeNumber}
								</a>
							{/if}
						{/if}
					{/if}
				</div>
			{:else if layout === 'gallery' && video.byline}
				<span class="mt-1 line-clamp-1 block text-xs text-base-400">{video.byline}</span>
			{/if}
		</article>
	{/each}
</HorizontalScroller>

{#if layout === 'gallery' && !showAllVideos && videos.length > 3}
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
