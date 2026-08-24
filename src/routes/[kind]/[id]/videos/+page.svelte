<script lang="ts">
	import { resolve } from '$app/paths';
	import Container from '$lib/components/Container.svelte';
	import VideoGallery from '$lib/components/VideoGallery.svelte';
	import { posterUrl } from '$lib/images';
	import { slugify, toMediaRouteKind } from '$lib/utils';
	import { VIDEO_TYPE_LABELS, VIDEO_TYPES, type VideoType } from '$lib/videos';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let selectedTypes = $state<string[]>([]);
	// svelte-ignore state_referenced_locally
	let selectedSeasons = $state<number[]>(data.initialSeason === null ? [] : [data.initialSeason]);
	let itemUrl = $derived(
		resolve('/[kind]/[id]', {
			kind: toMediaRouteKind(data.item.creativeWorkType),
			id: `${data.item.tmdbId}-${slugify(data.item.title)}`
		})
	);
	let typeOptions = $derived(getTypeOptions());
	let seasonOptions = $derived(
		[
			...new Set(
				data.videos.flatMap((video) =>
					video.context?.seasonNumber !== undefined ? [video.context.seasonNumber] : []
				)
			)
		].sort((left, right) => left - right)
	);
	let filteredVideos = $derived(
		data.videos.filter(
			(video) =>
				(selectedTypes.length === 0 || selectedTypes.includes(videoTypeKey(video.type))) &&
				(selectedSeasons.length === 0 ||
					(video.context?.seasonNumber !== undefined &&
						selectedSeasons.includes(video.context.seasonNumber)))
		)
	);

	function videoTypeKey(value: string) {
		return value
			.toLowerCase()
			.trim()
			.replaceAll(/[^a-z0-9]+/g, '_')
			.replaceAll(/^_|_$/g, '');
	}

	function videoTypeLabel(value: string) {
		if ((VIDEO_TYPES as readonly string[]).includes(value)) {
			return VIDEO_TYPE_LABELS[value as VideoType];
		}
		return value.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());
	}

	function getTypeOptions() {
		const present = new Set(data.videos.map((video) => videoTypeKey(video.type)));
		const ordered = VIDEO_TYPES.filter((type) => present.delete(type)).map((type) => ({
			value: type as string,
			label: VIDEO_TYPE_LABELS[type]
		}));
		return [
			...ordered,
			...[...present].sort().map((type) => ({ value: type, label: videoTypeLabel(type) }))
		];
	}

	function toggleType(type: string) {
		selectedTypes = selectedTypes.includes(type)
			? selectedTypes.filter((selected) => selected !== type)
			: [...selectedTypes, type];
	}

	function toggleSeason(season: number) {
		selectedSeasons = selectedSeasons.includes(season)
			? selectedSeasons.filter((selected) => selected !== season)
			: [...selectedSeasons, season];
	}
</script>

<svelte:head>
	<title>{data.item.title} videos | atmo.watch</title>
	<meta
		name="description"
		content={`Watch trailers, scenes, interviews, reviews, and other videos for ${data.item.title}.`}
	/>
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-16 text-base-50">
	<Container class="px-4 pt-10 sm:pt-14">
		<header class="flex items-center gap-4">
			<a
				href={itemUrl}
				class="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-base-900 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
			>
				{#if data.item.poster}
					<img
						src={posterUrl(data.item.poster, 'w185')}
						alt="Poster for {data.item.title}"
						class="size-full object-cover"
					/>
				{/if}
			</a>
			<div class="min-w-0">
				<p class="text-xs font-medium tracking-wide text-base-500 uppercase">Videos</p>
				<h1 class="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
					<a href={itemUrl} class="transition-colors hover:text-accent-300">{data.item.title}</a>
				</h1>
			</div>
		</header>

		{#if typeOptions.length > 1 || seasonOptions.length > 0}
			<div class="mt-8 space-y-5 border-y border-white/10 py-5">
				{#if typeOptions.length > 1}
					<fieldset>
						<legend class="text-xs font-semibold text-base-400">Video type</legend>
						<div class="mt-2 flex flex-wrap gap-2">
							<button
								type="button"
								onclick={() => (selectedTypes = [])}
								aria-pressed={selectedTypes.length === 0}
								class={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${selectedTypes.length === 0 ? 'border-accent-500/40 bg-accent-950 text-accent-300' : 'border-white/10 bg-white/[0.04] text-base-300 hover:bg-white/[0.08] hover:text-white'}`}
							>
								All types
							</button>
							{#each typeOptions as option (option.value)}
								<button
									type="button"
									onclick={() => toggleType(option.value)}
									aria-pressed={selectedTypes.includes(option.value)}
									class={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${selectedTypes.includes(option.value) ? 'border-accent-500/40 bg-accent-950 text-accent-300' : 'border-white/10 bg-white/[0.04] text-base-300 hover:bg-white/[0.08] hover:text-white'}`}
								>
									{option.label}
								</button>
							{/each}
						</div>
					</fieldset>
				{/if}

				{#if seasonOptions.length > 0}
					<fieldset>
						<legend class="text-xs font-semibold text-base-400">Season</legend>
						<div class="mt-2 flex flex-wrap gap-2">
							<button
								type="button"
								onclick={() => (selectedSeasons = [])}
								aria-pressed={selectedSeasons.length === 0}
								class={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${selectedSeasons.length === 0 ? 'border-accent-500/40 bg-accent-950 text-accent-300' : 'border-white/10 bg-white/[0.04] text-base-300 hover:bg-white/[0.08] hover:text-white'}`}
							>
								All seasons
							</button>
							{#each seasonOptions as season (season)}
								<button
									type="button"
									onclick={() => toggleSeason(season)}
									aria-pressed={selectedSeasons.includes(season)}
									class={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${selectedSeasons.includes(season) ? 'border-accent-500/40 bg-accent-950 text-accent-300' : 'border-white/10 bg-white/[0.04] text-base-300 hover:bg-white/[0.08] hover:text-white'}`}
								>
									{season === 0 ? 'Specials' : `Season ${season}`}
								</button>
							{/each}
						</div>
					</fieldset>
				{/if}
			</div>
		{/if}

		{#if filteredVideos.length > 0}
			<VideoGallery videos={filteredVideos} title={`${data.item.title} videos`} layout="grid" />
		{:else}
			<p
				class="mt-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-base-400"
			>
				No videos match these filters.
			</p>
		{/if}
	</Container>
</main>
