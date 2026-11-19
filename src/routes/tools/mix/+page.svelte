<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { navigating } from '$app/state';
	import { Icon } from '@atmo-dev/kit';
	import { X } from '@sketchyicons/svelte';
	import Container from '$lib/components/Container.svelte';
	import DefaultOpenGraphImage from '$lib/components/DefaultOpenGraphImage.svelte';
	import HorizontalScroller from '$lib/components/HorizontalScroller.svelte';
	import ItemsGrid from '$lib/components/ItemsGrid.svelte';
	import SearchCommand from '$lib/components/SearchCommand.svelte';
	import TabSelect from '$lib/components/TabSelect.svelte';
	import { posterUrl } from '$lib/images';
	import { addTopRated, MIX_MAX_PICKS, mixSearch } from '$lib/mix';
	import type { MediaIdentity, MediaSummary } from '$lib/types';
	import { mediaKey } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let filter = $state<'all' | 'movie' | 'tv_show'>('all');
	let full = $derived(data.picks.length >= MIX_MAX_PICKS);
	let rated = $derived(
		full
			? []
			: data.rated.filter((item) => !data.picks.some((pick) => mediaKey(pick) === mediaKey(item)))
	);
	let mixed = $derived(
		data.results.some((item) => item.creativeWorkType === 'movie') &&
			data.results.some((item) => item.creativeWorkType === 'tv_show')
	);
	let results = $derived(
		mixed && filter !== 'all'
			? data.results.filter((item) => item.creativeWorkType === filter)
			: data.results
	);

	function setPicks(picks: MediaIdentity[]) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved path plus a query string
		void goto(`${resolve('/tools/mix')}${mixSearch(picks)}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function add(item: MediaSummary) {
		if (full || data.picks.some((pick) => mediaKey(pick) === mediaKey(item))) return;
		setPicks([...data.picks, item]);
	}

	function remove(item: MediaSummary) {
		setPicks(data.picks.filter((pick) => mediaKey(pick) !== mediaKey(item)));
	}
</script>

<svelte:head>
	<title>Mix | atmo.watch</title>
	<meta name="description" content="Pick movies and shows you like and find more to watch." />
	{#if data.picks.length > 0}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

<DefaultOpenGraphImage />

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<Container class="px-4 pt-8 pb-16 sm:pt-12">
		<h1 class="text-2xl font-semibold tracking-tight">Mix</h1>

		{#if full}
			<p class="mt-6 text-sm text-base-400">{MIX_MAX_PICKS} titles is the most you can mix.</p>
		{:else}
			<SearchCommand
				did={data.did}
				autofocus={false}
				onSelect={add}
				placeholder="Add a movie or show…"
				class="mt-6"
			/>
		{/if}

		{#if data.picks.length > 0}
			<ul class="mt-4 flex flex-wrap gap-3" aria-label="Picked titles">
				{#each data.picks as pick (mediaKey(pick))}
					<li class="relative w-16">
						<div
							class="aspect-2/3 overflow-hidden rounded-md border border-base-800 bg-base-900"
							title={pick.title}
						>
							{#if pick.poster}
								<img
									src={posterUrl(pick.poster, 'w185')}
									alt={pick.title}
									class="size-full object-cover"
								/>
							{:else}
								<span class="line-clamp-4 p-1 text-[0.625rem] text-base-300">{pick.title}</span>
							{/if}
						</div>
						<button
							type="button"
							onclick={() => remove(pick)}
							aria-label="Remove {pick.title}"
							class="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-white/15 bg-base-800 text-white transition-colors hover:bg-base-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
						>
							<Icon img={X} class="size-3.5" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if rated.length > 0}
			<section class="mt-6">
				<div class="flex items-baseline justify-between gap-4">
					<h2 class="text-sm font-medium text-base-400">From your ratings</h2>
					<button
						type="button"
						onclick={() => setPicks(addTopRated(data.picks, data.rated))}
						class="text-xs font-semibold text-accent-400 hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
					>
						choose my highest rated
					</button>
				</div>
				<HorizontalScroller class="mt-2 gap-2 pb-1" label="Your rated titles">
					{#each rated as item (mediaKey(item))}
						<button
							type="button"
							onclick={() => add(item)}
							aria-label="Add {item.title}"
							title={item.title}
							class="aspect-2/3 w-16 shrink-0 snap-start overflow-hidden rounded-md border border-base-800 bg-base-900 transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/70"
						>
							{#if item.poster}
								<img
									src={posterUrl(item.poster, 'w185')}
									alt=""
									loading="lazy"
									class="size-full object-cover"
								/>
							{:else}
								<span class="line-clamp-4 p-1 text-[0.625rem] text-base-300">{item.title}</span>
							{/if}
						</button>
					{/each}
				</HorizontalScroller>
			</section>
		{/if}

		{#if data.unavailable}
			<p class="mt-6 text-sm text-red-400" role="alert">
				Some titles could not be loaded. Try again in a moment.
			</p>
		{/if}

		<section
			class="mt-8 transition-opacity {navigating.to ? 'opacity-50' : ''}"
			aria-live="polite"
			aria-busy={Boolean(navigating.to)}
		>
			{#if data.picks.length === 0}
				{#if !data.unavailable}
					<p class="text-sm text-base-400">Add a few titles you like to see what to watch next.</p>
				{/if}
			{:else if data.results.length === 0}
				<p class="text-sm text-base-400">Nothing to suggest for these yet.</p>
			{:else}
				{#if mixed}
					<TabSelect
						bind:value={filter}
						label="Filter suggestions"
						options={[
							{ value: 'all', label: 'All' },
							{ value: 'movie', label: 'Movies' },
							{ value: 'tv_show', label: 'Shows' }
						]}
					/>
				{/if}
				<ItemsGrid items={results} nofollow />
			{/if}
		</section>
	</Container>
</main>
