<script lang="ts">
	import type { MediaSummary } from '$lib/types';
	import { cn, mediaKey } from '$lib/utils';
	import ItemCard from './ItemCard.svelte';

	let {
		items,
		class: className
	}: {
		items: readonly MediaSummary[];
		class?: string;
	} = $props();
</script>

<div class={cn('flex gap-x-4 overflow-x-auto', className)}>
	{#each items as item (mediaKey(item))}
		<div class="w-24 shrink-0 sm:w-32">
			<ItemCard {item} showTitle={false} />
		</div>
	{/each}
</div>
