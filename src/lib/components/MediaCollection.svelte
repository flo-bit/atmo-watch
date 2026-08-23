<script lang="ts">
	import HorizontalScroller from './HorizontalScroller.svelte';
	import ItemCard from './ItemCard.svelte';
	import ItemsGrid from './ItemsGrid.svelte';
	import type { MediaSummary } from '$lib/types';
	import { cn } from '$lib/utils';

	let {
		title,
		items,
		class: className
	}: {
		title: string;
		items: readonly MediaSummary[];
		class?: string;
	} = $props();

	let expanded = $state(false);
	let desktopItems = $derived(expanded ? items : items.slice(0, 5));
</script>

<section class={cn('w-full', className)}>
	<h2 class="text-lg font-semibold tracking-tight text-white">{title}</h2>

	<HorizontalScroller class="mt-4 gap-3 pb-3 lg:hidden" label={title}>
		{#each items as item (`${item.creativeWorkType}:${item.tmdbId}`)}
			<div class="w-32 shrink-0 snap-start sm:w-36">
				<ItemCard {item} showTitle={false} />
			</div>
		{/each}
	</HorizontalScroller>
	<div class="hidden lg:block">
		<ItemsGrid items={desktopItems} class="mt-4" />
	</div>

	{#if !expanded && items.length > 5}
		<button
			type="button"
			onclick={() => (expanded = true)}
			class={cn(
				'mt-5 hidden h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 lg:inline-flex'
			)}
		>
			show more
			<svg
				class="size-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m6 9 6 6 6-6" />
			</svg>
		</button>
	{/if}
</section>
