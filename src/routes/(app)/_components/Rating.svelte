<script lang="ts">
	import { cn } from '../_lib/utils';

	let { rating, size = 'size-4' }: { rating: number; size?: string } = $props();
	let starRating = $derived(Math.max(0, Math.min(10, rating)) / 2);

	function fillFor(star: number) {
		return Math.max(0, Math.min(1, starRating - star + 1));
	}
</script>

{#snippet starIcon(className: string)}
	<svg class={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path
			fill-rule="evenodd"
			d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
			clip-rule="evenodd"
		/>
	</svg>
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
