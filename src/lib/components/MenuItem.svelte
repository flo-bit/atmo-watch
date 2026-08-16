<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { cn } from '@foxui/core';
	import type { Snippet } from 'svelte';

	let {
		href,
		label,
		tooltip = label,
		active = false,
		onclick,
		variant = 'sidebar',
		class: className,
		children
	}: {
		href?: Pathname;
		label: string;
		tooltip?: string;
		active?: boolean;
		onclick?: () => void;
		variant?: 'sidebar' | 'bottom';
		class?: string;
		children: Snippet;
	} = $props();

	let styles = $derived(
		cn(
			'group relative flex transition-colors',
			variant === 'bottom'
				? 'h-10 w-full items-center justify-center rounded-xl'
				: 'h-10 w-full items-center gap-3 rounded-lg p-2.5 text-sm font-semibold md:size-10',
			active
				? 'bg-accent-500/10 text-accent-300'
				: 'text-base-300 hover:bg-white/10 hover:text-white',
			className
		)
	);
</script>

{#snippet content()}
	{@render children()}
	<span class={variant === 'bottom' ? 'sr-only' : 'md:sr-only'}>{label}</span>
	{#if variant === 'sidebar'}
		<span
			class="pointer-events-none absolute left-14 hidden rounded-lg bg-accent-950/20 px-3 py-2 text-xs whitespace-nowrap text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 md:block"
		>
			{tooltip}
		</span>
	{/if}
{/snippet}

{#if href}
	<a href={resolve(href)} class={styles} aria-current={active ? 'page' : undefined}>
		{@render content()}
	</a>
{:else}
	<button type="button" {onclick} class={styles}>
		{@render content()}
	</button>
{/if}
