<script lang="ts">
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { loginDialog } from '$lib/login.svelte';
	import { UserRound } from '@lucide/svelte';
	import MenuItem from './MenuItem.svelte';

	let { did, onLoginOpen }: { did: string | null; onLoginOpen?: () => void } = $props();
	let profileHref: Pathname | undefined = $derived(
		did ? (`/profile/${did}` as Pathname) : undefined
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
	<UserRound class="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
</MenuItem>
