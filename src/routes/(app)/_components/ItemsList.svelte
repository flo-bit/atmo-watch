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

<div class={cn('flex gap-x-4 overflow-x-auto', className)}>
	{#each items as item (`${item.media_type}-${item.id}`)}
		<div class="w-24 shrink-0 sm:w-32">
			<ItemCard {item} showTitle={false} />
		</div>
	{/each}
</div>
