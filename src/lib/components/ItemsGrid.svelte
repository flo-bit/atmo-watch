<script lang="ts">
	import type { MediaSummary } from '$lib/types';
	import { cn, mediaKey } from '$lib/utils';
	import ItemCard from './ItemCard.svelte';

	let {
		items,
		class: className,
		nofollow = false
	}: {
		items: readonly MediaSummary[];
		class?: string;
		nofollow?: boolean;
	} = $props();
</script>

<div class={cn('mt-6 grid grid-cols-3 gap-4 sm:grid-cols-3 lg:grid-cols-5', className)}>
	{#each items as item (mediaKey(item))}
		<ItemCard {item} showTitle={false} {nofollow} />
	{/each}
</div>
