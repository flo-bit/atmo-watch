<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	let {
		children,
		class: className,
		label
	}: {
		children: Snippet;
		class?: string;
		label?: string;
	} = $props();
</script>

<div
	class={cn(
		'flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden',
		className
	)}
	aria-label={label}
>
	{@render children()}
</div>
