<script lang="ts">
	import { page } from '$app/state';
	import { Dialog } from 'bits-ui';
	import type { Item } from '../_lib/types';
	import { reviewDialog } from '../_lib/review.svelte';
	import SearchCommand from './SearchCommand.svelte';

	let menuOpen = $state(false);
	let searchOpen = $state(false);

	$effect(() => {
		page.url.pathname;
		menuOpen = false;
		searchOpen = false;
	});

	function reviewFromSearch(item: Item) {
		searchOpen = false;
		requestAnimationFrame(() => reviewDialog.show(item));
	}
</script>

<aside
	class={`fixed top-2 bottom-2 left-0 z-40 w-56 py-2 transition-transform duration-200 md:w-[4.5rem] md:translate-x-0 ${
		menuOpen ? 'translate-x-0' : '-translate-x-64'
	}`}
	aria-label="Main navigation"
>
	<nav
		class="bg-base-950/90 flex h-full flex-col items-start justify-end gap-2 px-3 py-3 backdrop-blur-xl md:items-center md:justify-start md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
	>
		<a
			href="/"
			class={`group relative flex h-10 w-full items-center gap-3 rounded-lg p-2.5 text-sm font-semibold transition-colors md:size-10 ${
				page.url.pathname === '/'
					? 'bg-accent-500/10 text-accent-300'
					: 'text-base-300 hover:bg-white/10 hover:text-white'
			}`}
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
					d="m2.25 12 8.954-8.955a1.125 1.125 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125C4.5 20.496 5.004 21 5.625 21H9.75v-4.875C9.75 15.504 10.254 15 10.875 15h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
				/>
			</svg>
			<span class="md:sr-only">Home</span>
			<span
				class="bg-accent-950/20 pointer-events-none absolute left-14 hidden rounded-lg px-3 py-2 text-xs whitespace-nowrap text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 md:block"
			>
				Home
			</span>
		</a>

		<Dialog.Root bind:open={searchOpen}>
			<Dialog.Trigger
				class="group text-base-300 relative flex h-10 w-full items-center gap-3 rounded-lg p-2.5 text-sm font-semibold transition-colors hover:bg-white/10 hover:text-white md:size-10"
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
						d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
					/>
				</svg>
				<span class="md:sr-only">Search</span>
				<span
					class="bg-accent-950/20 pointer-events-none absolute left-14 hidden rounded-lg px-3 py-2 text-xs whitespace-nowrap text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 md:block"
				>
					Search
				</span>
			</Dialog.Trigger>

			<Dialog.Portal>
				<Dialog.Overlay class="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md" />
				<Dialog.Content
					class="fixed top-[18vh] left-1/2 z-[101] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 outline-none"
				>
					<Dialog.Title class="sr-only">Search movies and TV shows</Dialog.Title>
					<Dialog.Description class="sr-only">
						Search for a movie or TV show by title.
					</Dialog.Description>
					<SearchCommand autofocus={searchOpen} onReview={reviewFromSearch} />
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
	</nav>
</aside>

{#if menuOpen}
	<button
		type="button"
		onclick={() => (menuOpen = false)}
		class="bg-base-950/85 fixed inset-0 z-30 backdrop-blur-sm md:hidden"
	>
		<span class="sr-only">Close menu</span>
	</button>
{/if}

<button
	type="button"
	onclick={() => (menuOpen = !menuOpen)}
	class="bg-base-900/80 fixed bottom-3 left-3 z-50 inline-flex size-10 items-center justify-center rounded-lg border border-white/10 text-white shadow-lg backdrop-blur-sm md:hidden"
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
