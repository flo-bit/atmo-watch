<script lang="ts">
	import { page } from '$app/state';
	import AccountMenuItem from './AccountMenuItem.svelte';
	import MenuItem from './MenuItem.svelte';
	import SearchMenuItem from './SearchMenuItem.svelte';

	let { did, avatarUrl }: { did: string | null; avatarUrl?: string } = $props();
</script>

{#snippet homeIcon()}
	<svg
		class="size-5 shrink-0"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		aria-hidden="true"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="m2.25 12 8.954-8.955a1.125 1.125 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125C4.5 20.496 5.004 21 5.625 21H9.75v-4.875C9.75 15.504 10.254 15 10.875 15h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
		/>
	</svg>
{/snippet}

<aside
	class="fixed top-2 bottom-2 left-0 z-40 hidden w-[4.5rem] py-2 md:block"
	aria-label="Main navigation"
>
	<nav class="flex h-full flex-col items-center justify-start gap-2">
		<MenuItem href="/" label="Home" active={page.url.pathname === '/'}>
			{@render homeIcon()}
		</MenuItem>

		<SearchMenuItem {did} />
		<AccountMenuItem {did} {avatarUrl} />
	</nav>
</aside>

<nav
	class="fixed inset-x-0 bottom-0 z-50 grid w-full grid-cols-3 gap-1 border-t border-white/10 bg-base-950/90 px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden"
	aria-label="Main navigation"
>
	<MenuItem href="/" label="Home" active={page.url.pathname === '/'} variant="bottom">
		{@render homeIcon()}
	</MenuItem>

	<SearchMenuItem {did} variant="bottom" />
	<AccountMenuItem {did} {avatarUrl} variant="bottom" />
</nav>
