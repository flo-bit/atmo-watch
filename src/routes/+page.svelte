<script lang="ts">
	import Container from '$lib/components/Container.svelte';
	import MediaCollection from '$lib/components/MediaCollection.svelte';
	import SearchCommand from '$lib/components/SearchCommand.svelte';

	let { data } = $props();
	let collections = $derived(
		[
			{ title: 'Popular movies', items: data.popularMovies },
			{ title: 'In theaters', items: data.currentlyInTheaters },
			{ title: 'Popular shows', items: data.popularShows },
			{ title: 'Recently reviewed in the atmosphere', items: data.recentlyReviewedInAtmosphere }
		].filter((collection) => collection.items.length > 0)
	);
</script>

<svelte:head>
	<title>Search movies and TV | atmo.watch</title>
	<meta name="description" content="Find a movie or TV show to review." />
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<Container class="px-4">
		<h1 class="sr-only">Search movies and TV shows</h1>

		<div class="mx-auto w-full max-w-xl pt-[18vh] sm:pt-[22vh]">
			<SearchCommand did={data.did} />
		</div>

		{#if collections.length > 0}
			<div class="mt-20 space-y-12 pb-12">
				{#each collections as collection, index (collection.title)}
					<MediaCollection
						title={collection.title}
						items={collection.items}
						class={index > 0 ? 'border-t border-white/10 pt-8' : undefined}
					/>
				{/each}
			</div>
		{:else}
			<p class="mt-20 pb-12 text-sm text-base-400">No movies or shows are available right now.</p>
		{/if}
	</Container>
</main>
