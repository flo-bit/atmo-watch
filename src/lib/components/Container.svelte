<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	let {
		children,
		class: className
	}: {
		children: Snippet;
		class?: string;
	} = $props();
</script>

<div class={cn('mx-auto max-w-2xl sm:px-6 lg:max-w-4xl lg:px-8', className)}>
	{@render children()}
</div>
