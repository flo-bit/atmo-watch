<script lang="ts">
	import type { Item } from '../_lib/types';
	import { cn } from '../_lib/utils';
	import ItemCard from './ItemCard.svelte';

	let {
		items,
		class: className
	}: {
		items: Item[];
		class?: string;
	} = $props();
</script>

<div class={cn('mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5', className)}>
	{#each items as item (`${item.media_type}-${item.id}`)}
		<ItemCard {item} showTitle={false} />
	{/each}
</div>
