<script lang="ts">
	import { cn } from '$lib/utils';

	type Props = {
		src?: string;
		alt?: string;
		shape?: 'circle' | 'rounded';
		class?: string;
	};

	let { src, alt = '', shape = 'circle', class: className = 'size-11' }: Props = $props();
</script>

<div
	class={cn(
		'overflow-hidden border border-base-400/50 bg-base-100 dark:border-base-700 dark:bg-base-800',
		shape === 'rounded' ? 'rounded-xl' : 'rounded-full',
		className
	)}
>
	{#if src}
		<img loading="lazy" class="size-full object-cover" {src} {alt} />
	{:else}
		<svg
			class="size-full text-base-300 dark:text-base-600"
			fill="currentColor"
			viewBox="0 0 24 24"
			preserveAspectRatio={shape === 'rounded' ? 'xMidYMax meet' : 'xMidYMid meet'}
			aria-hidden="true"
		>
			<path
				d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"
			/>
		</svg>
	{/if}
</div>
