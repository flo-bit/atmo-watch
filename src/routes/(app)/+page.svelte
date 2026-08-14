<script lang="ts">
	import Container from './_components/Container.svelte';
	import TabSelect from './_components/TabSelect.svelte';
	import ItemsGrid from './_components/ItemsGrid.svelte';
	import SearchCommand from './_components/SearchCommand.svelte';

	let { data } = $props();
	let selected = $state<'popular' | 'theaters'>('popular');
	let selectedItems = $derived(selected === 'popular' ? data.popular : data.currentlyInTheaters);
	const collections = [
		{ value: 'popular', label: 'popular' },
		{ value: 'theaters', label: 'in theaters' }
	] satisfies Array<{ value: typeof selected; label: string }>;
</script>

<svelte:head>
	<title>Search movies and TV | atmo.watch</title>
	<meta name="description" content="Find a movie or TV show to review." />
</svelte:head>

<main class="bg-base-950 text-base-50 min-h-dvh pb-12">
	<Container class="px-4">
		<h1 class="sr-only">Search movies and TV shows</h1>

		<div class="mx-auto w-full max-w-xl pt-[18vh] sm:pt-[22vh]">
			<SearchCommand />
		</div>

		<section class="mt-20 w-full pb-12">
			<h2 class="sr-only">Browse movies and TV shows</h2>

			<TabSelect bind:value={selected} options={collections} label="Choose collection" />

			{#if selectedItems.length > 0}
				<ItemsGrid items={selectedItems} />
			{:else}
				<p class="text-base-400 mt-8 text-sm">This collection is unavailable right now.</p>
			{/if}
		</section>
	</Container>
</main>
