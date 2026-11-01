<script lang="ts">
	import { page } from '$app/state';
	import { Modal, Icon } from '@atmo-dev/kit';
	import { Search } from '@sketchyicons/svelte';
	import { loginDialog } from '$lib/login.svelte';
	import { reviewDialog } from '$lib/review.svelte';
	import type { MediaSummary } from '$lib/types';
	import MenuItem from './MenuItem.svelte';
	import SearchCommand from './SearchCommand.svelte';

	let {
		did,
		variant = 'sidebar',
		onOpen
	}: { did: string | null; variant?: 'sidebar' | 'bottom'; onOpen?: () => void } = $props();
	let open = $state(false);

	$effect(() => {
		if (page.url.pathname) open = false;
	});

	function openSearch() {
		onOpen?.();
		open = true;
	}

	function reviewFromSearch(item: MediaSummary) {
		open = false;
		requestAnimationFrame(() => reviewDialog.show(item));
	}

	function loginFromSearch() {
		open = false;
		requestAnimationFrame(() => loginDialog.show());
	}
</script>

<MenuItem label="Search" onclick={openSearch} {variant}>
	<Icon img={Search} class="size-5 shrink-0" />
</MenuItem>

<Modal
	bind:open
	title="Search movies and TV shows"
	class="top-[18vh] max-w-xl translate-y-0 overflow-visible bg-base-950 p-3 sm:p-3 [&_h2]:text-sm [&>header]:mb-3"
>
	<SearchCommand
		{did}
		autofocus={open}
		onReview={reviewFromSearch}
		onLoginRequired={loginFromSearch}
	/>
</Modal>
