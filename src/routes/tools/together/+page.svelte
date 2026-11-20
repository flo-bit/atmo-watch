<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { navigating } from '$app/state';
	import { ActorSearchField, createActorSearch, Icon } from '@atmo-dev/kit';
	import { X } from '@sketchyicons/svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import Container from '$lib/components/Container.svelte';
	import DefaultOpenGraphImage from '$lib/components/DefaultOpenGraphImage.svelte';
	import ItemsGrid from '$lib/components/ItemsGrid.svelte';
	import TabSelect from '$lib/components/TabSelect.svelte';
	import { normalizeActor, TOGETHER_MAX_PEOPLE, togetherSearch } from '$lib/together';
	import type { MediaSummary } from '$lib/types';
	import type { PageData } from './$types';

	const searchActors = createActorSearch();

	let { data }: { data: PageData } = $props();
	let handle = $state('');
	let input = $state<HTMLInputElement | null>(null);
	let invalid = $state(false);
	let filter = $state<'all' | 'movie' | 'tv_show'>('all');
	let full = $derived(data.people.length >= TOGETHER_MAX_PEOPLE);
	let includesViewer = $derived(data.people.some((person) => person.did === data.did));
	let all = $derived([...data.watchlist, ...data.suggestions]);
	let mixed = $derived(
		all.some((item) => item.creativeWorkType === 'movie') &&
			all.some((item) => item.creativeWorkType === 'tv_show')
	);

	function shown(items: MediaSummary[]) {
		return mixed && filter !== 'all'
			? items.filter((item) => item.creativeWorkType === filter)
			: items;
	}

	// An account without a usable handle stays addressable by its DID.
	function actorOf(person: PageData['people'][number]) {
		return normalizeActor(person.handle) && person.handle !== 'handle.invalid'
			? person.handle
			: person.did;
	}

	function setActors(actors: string[]) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved path plus a query string
		void goto(`${resolve('/tools/together')}${togetherSearch(actors)}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function add(value: string) {
		const actor = normalizeActor(value);
		invalid = !actor;
		if (!actor || full) return;

		// The suggestion list writes the chosen handle back after this runs.
		void tick().then(() => {
			handle = '';
			if (input) input.value = '';
		});
		const current = data.people.map(actorOf);
		if (!current.includes(actor)) setActors([...current, actor]);
	}

	function remove(did: string) {
		setActors(data.people.filter((person) => person.did !== did).map(actorOf));
	}
</script>

<svelte:head>
	<title>Watch together | atmo.watch</title>
	<meta name="description" content="Find a movie or show everyone wants to watch." />
	{#if data.people.length > 0}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

<DefaultOpenGraphImage />

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<Container class="px-4 pt-8 pb-16 sm:pt-12">
		<h1 class="text-2xl font-semibold tracking-tight">Watch together</h1>

		{#if full}
			<p class="mt-6 text-sm text-base-400">
				{TOGETHER_MAX_PEOPLE} people is the most you can add.
			</p>
		{:else}
			<form
				class="mt-6"
				onsubmit={(event) => {
					event.preventDefault();
					add(handle);
				}}
			>
				<ActorSearchField
					bind:value={handle}
					bind:ref={input}
					{searchActors}
					onSelect={(actor) => add(actor.handle)}
					label="Add a person"
					placeholder="Add a handle…"
					{invalid}
				/>
				{#if invalid}
					<p class="mt-2 text-xs text-red-400" role="alert">Enter a full handle.</p>
				{/if}
			</form>
		{/if}

		{#if data.people.length > 0 || (data.did && !includesViewer)}
			<ul class="mt-4 flex flex-wrap gap-2" aria-label="People">
				{#each data.people as person (person.did)}
					<li
						class="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pr-1 pl-1 text-sm"
					>
						<Avatar src={person.avatarUrl} alt="" class="size-6" />
						<span class="max-w-40 truncate">{person.displayName || person.handle}</span>
						<button
							type="button"
							onclick={() => remove(person.did)}
							aria-label="Remove {person.displayName || person.handle}"
							class="flex size-6 items-center justify-center rounded-full text-base-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/70"
						>
							<Icon img={X} class="size-3.5" />
						</button>
					</li>
				{/each}
				{#if data.did && !includesViewer && !full}
					<li>
						<button
							type="button"
							onclick={() => add(data.did ?? '')}
							class="h-8.5 rounded-full border border-dashed border-white/20 px-3 text-sm text-base-300 transition-colors hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-white/70"
						>
							add me
						</button>
					</li>
				{/if}
			</ul>
		{/if}

		{#if data.missing.length > 0}
			<p class="mt-4 text-sm text-red-400" role="alert">
				Could not find {data.missing.join(', ')}.
			</p>
		{/if}
		{#each data.people.filter((person) => person.empty) as person (person.did)}
			<p class="mt-4 text-sm text-base-400">
				{person.displayName || person.handle} has not rated or saved anything yet.
			</p>
		{/each}
		{#if data.unavailable}
			<p class="mt-4 text-sm text-red-400" role="alert">
				Some things could not be loaded. Try again in a moment.
			</p>
		{/if}

		<div
			class="mt-8 transition-opacity {navigating.to ? 'opacity-50' : ''}"
			aria-live="polite"
			aria-busy={Boolean(navigating.to)}
		>
			{#if data.people.length < 2}
				<p class="text-sm text-base-400">
					{data.people.length === 0
						? 'Add two or more people to find something you would all watch.'
						: 'Add one more person.'}
				</p>
			{:else if all.length === 0}
				{#if !data.unavailable}
					<p class="text-sm text-base-400">Nothing to suggest for this group yet.</p>
				{/if}
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
				{#if shown(data.watchlist).length > 0}
					<section class="mt-6">
						<h2 class="text-sm font-medium text-base-400">From your watchlists</h2>
						<ItemsGrid items={shown(data.watchlist)} nofollow />
					</section>
				{/if}
				{#if shown(data.suggestions).length > 0}
					<section class="mt-8">
						<h2 class="text-sm font-medium text-base-400">Based on what you rated</h2>
						<ItemsGrid items={shown(data.suggestions)} nofollow />
					</section>
				{/if}
			{/if}
		</div>
	</Container>
</main>
