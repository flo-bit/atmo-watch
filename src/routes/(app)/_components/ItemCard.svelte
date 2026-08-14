<script lang="ts">
	import { posterUrl } from '../_lib/images';
	import type { Item } from '../_lib/types';
	import { slugify } from '../_lib/utils';
	import Rating from './Rating.svelte';

	let {
		item,
		showTitle = true,
		showRating = false
	}: { item: Item; showTitle?: boolean; showRating?: boolean } = $props();
	let randomRating = $derived(((Math.imul(item.id, 2_654_435_761) >>> 0) % 10) + 1);
	let watched = $derived(false);
</script>

<div class="group relative">
	<div
		class="border-base-800 bg-base-900/50 pointer-events-none relative z-20 aspect-2/3 h-auto min-h-44 w-full overflow-hidden rounded-md border transition-opacity duration-75 group-hover:opacity-75"
	>
		{#if item.poster_path}
			<img
				src={posterUrl(item.poster_path, 'w342')}
				alt="Poster for {item.title}"
				class="size-full object-cover object-center"
				loading="lazy"
			/>
		{/if}
		{#if watched}
			<div
				class="absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-zinc-900/80 px-1.5 py-0.5 text-[9px] leading-none font-medium text-zinc-300 ring-1 ring-zinc-500/20 backdrop-blur-sm"
			>
				watched
			</div>
		{/if}

		{#if showRating}
			<div class="absolute inset-0 bg-linear-to-b from-transparent via-black/10 to-black/70"></div>
			<div class="absolute right-0 bottom-2 left-0 flex justify-center">
				<Rating rating={randomRating} />
			</div>
		{/if}
	</div>

	{#if showTitle}
		<h3 class="text-base-50 mt-2 text-sm font-medium sm:text-base">
			<a href="/{item.media_type}/{item.id}-{slugify(item.title)}">
				<span aria-hidden="true" class="absolute inset-0"></span>
				<span class="line-clamp-2">{item.title}</span>
			</a>
		</h3>
	{:else}
		<a
			href="/{item.media_type}/{item.id}-{slugify(item.title)}"
			aria-label={item.title}
			class="absolute inset-0 z-30"
		></a>
	{/if}
</div>
