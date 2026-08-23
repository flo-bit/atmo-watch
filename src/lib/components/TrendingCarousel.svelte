<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import { backdropUrl, logoUrl } from '$lib/images';
	import type { MediaFeature } from '$lib/types';
	import { slugify, toMediaRouteKind } from '$lib/utils';
	import ExternalRatings from './ExternalRatings.svelte';

	let { items }: { items: readonly MediaFeature[] } = $props();
	let currentIndex = $state(0);
	let paused = $state(false);
	let current = $derived(items[currentIndex] ?? items[0]);
	let imageUrl = $derived(backdropUrl(current?.item.backdrop, 'w1280'));
	let originalImageUrl = $derived(backdropUrl(current?.item.backdrop, 'original'));
	let titleLogoUrl = $derived(logoUrl(current?.logo?.path, 'w500'));
	let titleLogoOriginalUrl = $derived(logoUrl(current?.logo?.path, 'original'));
	let touchStartX = $state<number | null>(null);
	let backdropElement = $state<HTMLImageElement | null>(null);
	let wordmarkElement = $state<HTMLElement | null>(null);

	function itemUrl(feature: MediaFeature) {
		return resolve('/[kind]/[id]', {
			kind: toMediaRouteKind(feature.item.creativeWorkType),
			id: `${feature.item.tmdbId}-${slugify(feature.item.title)}`
		});
	}

	function goTo(index: number) {
		if (items.length === 0) return;
		currentIndex = (index + items.length) % items.length;
	}

	function preparePageTransition() {
		backdropElement?.classList.add('media-page-backdrop');
		wordmarkElement?.classList.add('media-page-wordmark');
		document.documentElement.dataset.mediaTransition = 'true';
	}

	function handleTouchStart(event: TouchEvent) {
		touchStartX = event.touches[0]?.clientX ?? null;
		paused = true;
	}

	function handleTouchEnd(event: TouchEvent) {
		const endX = event.changedTouches[0]?.clientX;
		if (touchStartX !== null && endX !== undefined) {
			const distance = endX - touchStartX;
			if (distance <= -50) goTo(currentIndex + 1);
			if (distance >= 50) goTo(currentIndex - 1);
		}
		touchStartX = null;
		paused = false;
	}

	$effect(() => {
		if (currentIndex >= items.length) currentIndex = 0;
	});

	$effect(() => {
		if (items.length <= 1) return;

		const size = window.matchMedia('(min-width: 1024px)').matches ? 'original' : 'w1280';
		for (const offset of [-1, 1]) {
			const feature = items[(currentIndex + offset + items.length) % items.length];
			const backdrop = backdropUrl(feature?.item.backdrop, size);
			const wordmark = logoUrl(feature?.logo?.path, 'original');
			if (backdrop) new Image().src = backdrop;
			if (wordmark) new Image().src = wordmark;
		}
	});

	$effect(() => {
		if (
			paused ||
			items.length <= 1 ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return;
		}

		const interval = window.setInterval(() => goTo(currentIndex + 1), 7000);
		return () => window.clearInterval(interval);
	});
</script>

{#if current && imageUrl}
	<section
		class="relative h-[50svh] w-full touch-pan-y overflow-hidden bg-base-900 sm:aspect-video sm:h-auto lg:aspect-auto lg:h-[80svh]"
		aria-roledescription="carousel"
		aria-label="Trending movies and shows"
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}
		ontouchcancel={() => {
			touchStartX = null;
			paused = false;
		}}
		onmouseenter={() => (paused = true)}
		onmouseleave={() => (paused = false)}
		onfocusin={() => (paused = true)}
		onfocusout={() => (paused = false)}
	>
		{#key `${current.item.creativeWorkType}:${current.item.tmdbId}`}
			<a
				href={itemUrl(current)}
				transition:fade={{ duration: 600 }}
				onclick={preparePageTransition}
				aria-label={`View ${current.item.title}`}
				class="group absolute inset-0 z-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-400"
				data-sveltekit-preload-data="hover"
			>
				<picture class="contents">
					{#if originalImageUrl}
						<source media="(min-width: 1024px)" srcset={originalImageUrl} />
					{/if}
					<img
						bind:this={backdropElement}
						src={imageUrl}
						alt=""
						class="size-full object-cover object-center transition duration-700 group-hover:scale-[1.015] motion-reduce:transition-none"
						fetchpriority={currentIndex === 0 ? 'high' : 'auto'}
					/>
				</picture>
			</a>
		{/key}

		<span class="pointer-events-none absolute inset-0 z-10 bg-black/10" aria-hidden="true"></span>
		<span
			class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3/5 bg-linear-to-t from-base-950 via-base-950/45 to-transparent"
			aria-hidden="true"
		></span>
		{#key `${current.item.creativeWorkType}:${current.item.tmdbId}`}
			<div
				transition:fade={{ duration: 600 }}
				class="absolute right-12 bottom-6 left-12 z-20 flex flex-col items-center text-center sm:bottom-8"
			>
				<a
					href={itemUrl(current)}
					onclick={preparePageTransition}
					class="flex max-w-full justify-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
					data-sveltekit-preload-data="hover"
				>
					{#if titleLogoUrl && titleLogoOriginalUrl}
						<span class="sr-only">{current.item.title}</span>
						<picture class="contents">
							<source srcset={`${titleLogoUrl} 1x, ${titleLogoOriginalUrl} 2x`} />
							<img
								bind:this={wordmarkElement}
								src={titleLogoUrl}
								alt=""
								width={current.logo?.width}
								height={current.logo?.height}
								class="max-h-20 w-full max-w-56 object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] sm:max-h-24 sm:max-w-sm"
							/>
						</picture>
					{:else}
						<span
							bind:this={wordmarkElement}
							class="text-2xl leading-tight font-bold tracking-tight text-white drop-shadow-xl sm:text-4xl"
						>
							{current.item.title}
						</span>
					{/if}
				</a>
				<div class="mt-3 flex justify-center text-white">
					<ExternalRatings
						popfeedScore={current.popfeedScore}
						popfeedRatingCount={current.popfeedRatingCount}
						imdbId={current.imdbId}
						imdbVotes={current.imdbVotes}
						ratings={current.ratings}
						showCounts={false}
					/>
				</div>
			</div>
		{/key}

		{#if items.length > 1}
			<button
				type="button"
				onclick={() => goTo(currentIndex - 1)}
				class="absolute top-1/2 left-2 z-50 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-3"
				aria-label="Previous trending title"
			>
				<ChevronLeft class="size-5" strokeWidth={1.8} aria-hidden="true" />
			</button>
			<button
				type="button"
				onclick={() => goTo(currentIndex + 1)}
				class="absolute top-1/2 right-2 z-30 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-3"
				aria-label="Next trending title"
			>
				<ChevronRight class="size-5" strokeWidth={1.8} aria-hidden="true" />
			</button>
		{/if}
	</section>
{/if}
