<script lang="ts">
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { loginDialog } from '$lib/login.svelte';
	import { UserRound } from '@lucide/svelte';
	import Avatar from './Avatar.svelte';
	import MenuItem from './MenuItem.svelte';

	let {
		did,
		avatarUrl,
		variant = 'sidebar',
		onLoginOpen
	}: {
		did: string | null;
		avatarUrl?: string;
		variant?: 'sidebar' | 'bottom';
		onLoginOpen?: () => void;
	} = $props();
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
	{variant}
	class={variant === 'sidebar' ? (did ? 'p-1.5 md:mt-auto md:p-1.5' : 'md:mt-auto') : undefined}
>
	{#if did}
		<Avatar
			src={avatarUrl}
			alt=""
			class={variant === 'bottom' ? 'size-6 shrink-0' : 'size-7 shrink-0'}
		/>
	{:else}
		<UserRound class="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
	{/if}
</MenuItem>
