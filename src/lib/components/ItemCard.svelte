<script lang="ts">
	import { resolve } from '$app/paths';
	import { posterUrl } from '$lib/images';
	import type { MediaSummary } from '$lib/types';
	import { slugify, toMediaRouteKind } from '$lib/utils';
	import Rating from './Rating.svelte';

	let {
		item,
		showTitle = true,
		rating
	}: { item: MediaSummary; showTitle?: boolean; rating?: number } = $props();
	let itemUrl = $derived(
		resolve('/[kind]/[id]', {
			kind: toMediaRouteKind(item.creativeWorkType),
			id: `${item.tmdbId}-${slugify(item.title)}`
		})
	);
</script>

<div class="group relative">
	<div
		class="pointer-events-none relative z-20 aspect-2/3 h-auto min-h-44 w-full overflow-hidden rounded-md border border-base-800 bg-base-900/50 transition-opacity duration-75 group-hover:opacity-75"
	>
		{#if item.poster}
			<img
				src={posterUrl(item.poster, 'w342')}
				alt="Poster for {item.title}"
				class="size-full object-cover object-center"
				loading="lazy"
			/>
		{/if}
		{#if rating !== undefined}
			<div class="absolute inset-0 bg-linear-to-b from-transparent via-black/10 to-black/70"></div>
			<div class="absolute right-0 bottom-2 left-0 flex justify-center">
				<Rating {rating} />
			</div>
		{/if}
	</div>

	{#if showTitle}
		<h3 class="mt-2 text-sm font-medium text-base-50 sm:text-base">
			<a href={itemUrl} data-sveltekit-preload-data="hover">
				<span aria-hidden="true" class="absolute inset-0"></span>
				<span class="line-clamp-2">{item.title}</span>
			</a>
		</h3>
	{:else}
		<a
			href={itemUrl}
			aria-label={item.title}
			class="absolute inset-0 z-30"
			data-sveltekit-preload-data="hover"
		></a>
	{/if}
</div>
