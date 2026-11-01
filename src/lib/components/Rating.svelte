<script lang="ts">
	import { cn, Icon } from '@atmo-dev/kit';
	import { Star } from '@sketchyicons/svelte';

	let { rating, size = 'size-4' }: { rating: number; size?: string } = $props();
	let starRating = $derived(Math.max(0, Math.min(10, rating)) / 2);

	function fillFor(star: number) {
		return Math.max(0, Math.min(1, starRating - star + 1));
	}
</script>

{#snippet starIcon(className: string)}
	<Icon img={Star} class={cn(className, '[&_path]:fill-current')} />
{/snippet}

<div
	class="flex items-center"
	role="img"
	aria-label={`${rating} out of 10, ${starRating} out of 5 stars`}
>
	{#each [1, 2, 3, 4, 5] as star (star)}
		{@const fill = fillFor(star)}
		<span class={cn('relative block shrink-0', size)}>
			{@render starIcon('absolute inset-0 size-full stroke-base-500 text-base-600')}

			{#if fill > 0}
				<span class="absolute inset-y-0 left-0 overflow-hidden" style:width={`${fill * 100}%`}>
					{@render starIcon(cn(size, 'max-w-none stroke-accent-400 text-accent-500'))}
				</span>
			{/if}
		</span>
	{/each}
</div>
