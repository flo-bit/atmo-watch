<script lang="ts">
	import { page } from '$app/state';
	import { Icon } from '@atmo-dev/kit';
	import { Clapperboard, House } from '@sketchyicons/svelte';
	import AccountMenuItem from './AccountMenuItem.svelte';
	import MenuItem from './MenuItem.svelte';
	import SearchMenuItem from './SearchMenuItem.svelte';

	let { did, avatarUrl }: { did: string | null; avatarUrl?: string } = $props();
</script>

{#snippet homeIcon()}
	<Icon img={House} class="size-5 shrink-0" />
{/snippet}

<aside
	class="fixed top-2 bottom-2 left-0 z-40 hidden w-[4.5rem] py-2 md:block"
	aria-label="Main navigation"
>
	<nav class="flex h-full flex-col items-center justify-start gap-2">
		<MenuItem href="/" label="Home" active={page.url.pathname === '/'}>
			{@render homeIcon()}
		</MenuItem>

		<MenuItem href="/videos" label="Videos" active={page.url.pathname === '/videos'}>
			<Icon img={Clapperboard} class="size-5 shrink-0" />
		</MenuItem>

		<SearchMenuItem {did} />
		<AccountMenuItem {did} {avatarUrl} />
	</nav>
</aside>

<nav
	class="fixed inset-x-0 bottom-0 z-50 grid w-full grid-cols-4 gap-1 border-t border-white/10 bg-base-950/90 px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden"
	aria-label="Main navigation"
>
	<MenuItem href="/" label="Home" active={page.url.pathname === '/'} variant="bottom">
		{@render homeIcon()}
	</MenuItem>

	<MenuItem href="/videos" label="Videos" active={page.url.pathname === '/videos'} variant="bottom">
		<Icon img={Clapperboard} class="size-5 shrink-0" />
	</MenuItem>

	<SearchMenuItem {did} variant="bottom" />
	<AccountMenuItem {did} {avatarUrl} variant="bottom" />
</nav>
