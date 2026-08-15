<script lang="ts">
	import { page } from '$app/state';
	import { Dialog } from 'bits-ui';
	import type { Item } from '$lib/types';
	import { reviewDialog } from '$lib/review.svelte';
	import MenuItem from './MenuItem.svelte';
	import SearchCommand from './SearchCommand.svelte';

	let { onOpen }: { onOpen?: () => void } = $props();
	let open = $state(false);

	$effect(() => {
		if (page.url.pathname) open = false;
	});

	function openSearch() {
		onOpen?.();
		open = true;
	}

	function reviewFromSearch(item: Item) {
		open = false;
		requestAnimationFrame(() => reviewDialog.show(item));
	}
</script>

<Dialog.Root bind:open>
	<MenuItem label="Search" onclick={openSearch}>
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
				d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
			/>
		</svg>
	</MenuItem>

	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md" />
		<Dialog.Content
			class="fixed top-[18vh] left-1/2 z-[101] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 outline-none"
		>
			<Dialog.Title class="sr-only">Search movies and TV shows</Dialog.Title>
			<Dialog.Description class="sr-only">
				Search for a movie or TV show by title.
			</Dialog.Description>
			<SearchCommand autofocus={open} onReview={reviewFromSearch} />
			<Dialog.Close
				class="absolute -top-12 right-0 inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
			>
				<svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
						clip-rule="evenodd"
					/>
				</svg>
				<span class="sr-only">Close search</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
