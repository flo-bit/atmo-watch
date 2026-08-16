<script lang="ts">
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
	let mobileItems = $derived(expanded ? items : items.slice(0, 6));
	let desktopItems = $derived(expanded ? items : items.slice(0, 10));
</script>

<section class={cn('w-full', className)}>
	<h2 class="text-lg font-semibold tracking-tight text-white">{title}</h2>

	<div class="lg:hidden">
		<ItemsGrid items={mobileItems} class="mt-4" />
	</div>
	<div class="hidden lg:block">
		<ItemsGrid items={desktopItems} class="mt-4" />
	</div>

	{#if !expanded && items.length > 6}
		<button
			type="button"
			onclick={() => (expanded = true)}
			class={cn(
				'mt-5 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
				items.length <= 10 && 'lg:hidden'
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
