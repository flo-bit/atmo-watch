<script lang="ts">
	import { page } from '$app/state';
	import AccountMenuItem from './AccountMenuItem.svelte';
	import MenuItem from './MenuItem.svelte';
	import SearchMenuItem from './SearchMenuItem.svelte';

	let { did }: { did: string | null } = $props();
	let menuOpen = $state(false);

	$effect(() => {
		if (page.url.pathname) menuOpen = false;
	});
</script>

<aside
	class={`fixed top-2 bottom-2 left-0 z-40 w-56 py-2 transition-transform duration-200 md:w-[4.5rem] md:translate-x-0 ${
		menuOpen ? 'translate-x-0' : '-translate-x-64'
	}`}
	aria-label="Main navigation"
>
	<nav
		class="flex h-full flex-col items-start justify-end gap-2 bg-base-950/90 px-3 pt-3 pb-14 backdrop-blur-xl md:items-center md:justify-start md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
	>
		<MenuItem href="/" label="Home" active={page.url.pathname === '/'}>
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
		</MenuItem>

		<SearchMenuItem onOpen={() => (menuOpen = false)} />
		<AccountMenuItem {did} onLoginOpen={() => (menuOpen = false)} />
	</nav>
</aside>

{#if menuOpen}
	<button
		type="button"
		onclick={() => (menuOpen = false)}
		class="fixed inset-0 z-30 bg-base-950/85 backdrop-blur-sm md:hidden"
	>
		<span class="sr-only">Close menu</span>
	</button>
{/if}

<button
	type="button"
	onclick={() => (menuOpen = !menuOpen)}
	class="fixed bottom-3 left-3 z-50 inline-flex size-10 items-center justify-center rounded-lg border border-white/10 bg-base-900/80 text-white shadow-lg backdrop-blur-sm md:hidden"
	aria-expanded={menuOpen}
	aria-label={menuOpen ? 'Close menu' : 'Open menu'}
>
	{#if menuOpen}
		<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
		</svg>
	{:else}
		<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 7.5h16.5m-16.5 9h16.5" />
		</svg>
	{/if}
</button>
