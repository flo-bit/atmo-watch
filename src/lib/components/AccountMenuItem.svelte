<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { loginDialog } from '$lib/login.svelte';
	import MenuItem from './MenuItem.svelte';

	let { did, onLoginOpen }: { did: string | null; onLoginOpen?: () => void } = $props();
	let profileHref: Pathname | undefined = $derived(
		did ? (resolve('/profile/[actor]', { actor: did }) as Pathname) : undefined
	);
	let active = $derived(
		did !== null && page.route.id === '/profile/[actor]' && page.params.actor === did
	);

	function openLogin() {
		onLoginOpen?.();
		loginDialog.show();
	}
</script>

<MenuItem
	href={profileHref}
	label={did ? 'Profile' : 'Log in'}
	tooltip={did ? 'Profile' : 'Log in'}
	{active}
	onclick={openLogin}
	class="md:mt-auto"
>
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
			d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
		/>
	</svg>
</MenuItem>
