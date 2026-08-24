<script lang="ts">
	import { resolve } from '$app/paths';
	import Container from '$lib/components/Container.svelte';
	import { posterUrl } from '$lib/images';
	import { slugify } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let context = $derived(data.video.context);
	let embedUrl = $derived(
		`https://www.youtube-nocookie.com/embed/${encodeURIComponent(data.video.key)}?playsinline=1&rel=0`
	);
	let mediaTitle = $derived(
		data.mediaHeader?.item.title ?? context?.seriesTitle ?? context?.title ?? 'Movie or TV show'
	);
	let mediaPoster = $derived(data.mediaHeader?.item.poster ?? null);
	let rootMediaUrl = $derived(getRootMediaUrl());
	let seasonUrl = $derived(getSeasonUrl());
	let episodeUrl = $derived(getEpisodeUrl());

	function getShowId() {
		if (!context || context.creativeWorkType === 'movie') return null;
		const showTmdbId =
			context.creativeWorkType === 'tv_show' ? context.tmdbId : context.tmdbTvSeriesId;
		return showTmdbId ? `${showTmdbId}-${slugify(mediaTitle)}` : null;
	}

	function getRootMediaUrl() {
		if (!context) return null;
		if (context.creativeWorkType === 'movie') {
			return resolve('/[kind]/[id]', {
				kind: 'movie',
				id: `${context.tmdbId}-${slugify(mediaTitle)}`
			});
		}

		const showId = getShowId();
		return showId ? resolve('/[kind]/[id]', { kind: 'tv', id: showId }) : null;
	}

	function getSeasonUrl() {
		const showId = getShowId();
		if (!showId || context?.seasonNumber === undefined) return null;
		return resolve('/[kind]/[id]/season/[season]', {
			kind: 'tv',
			id: showId,
			season: String(context.seasonNumber)
		});
	}

	function getEpisodeUrl() {
		const showId = getShowId();
		if (!showId || context?.seasonNumber === undefined || context.episodeNumber === undefined) {
			return null;
		}
		return resolve(`/[kind]/[id]/season/[season]#episode-${context.episodeNumber}`, {
			kind: 'tv',
			id: showId,
			season: String(context.seasonNumber)
		});
	}
</script>

<svelte:head>
	<title>{data.video.name} | atmo.watch</title>
	<meta name="description" content={`Watch ${data.video.name} on atmo.watch.`} />
	{#if data.video.thumbnailUrl}
		<meta property="og:image" content={data.video.thumbnailUrl} />
	{/if}
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-16 text-base-50">
	<Container class="px-4 pt-8 sm:pt-12">
		<div class="mx-auto max-w-4xl">
			<div
				class="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/30"
			>
				<iframe
					src={embedUrl}
					title={data.video.name}
					class="size-full border-0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					referrerpolicy="strict-origin-when-cross-origin"
					allowfullscreen
				></iframe>
			</div>

			<div class="mt-5 flex flex-wrap items-start justify-between gap-3">
				<h1 class="min-w-0 text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
					{data.video.name}
				</h1>
				<div class="flex shrink-0 items-center gap-2">
					<span
						class="rounded-full bg-white/10 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase"
					>
						{data.video.type}
					</span>
					{#if data.video.containsSpoilers}
						<span class="rounded-full bg-white/10 px-2.5 py-1 text-[0.6875rem] font-semibold">
							spoilers
						</span>
					{/if}
				</div>
			</div>

			{#if context && rootMediaUrl}
				<div class="mt-7 flex w-fit max-w-full items-center gap-3">
					<a
						href={rootMediaUrl}
						class="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-base-900 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
					>
						{#if mediaPoster}
							<img
								src={posterUrl(mediaPoster, 'w185')}
								alt="Poster for {mediaTitle}"
								class="size-full object-cover"
							/>
						{/if}
					</a>
					<div class="min-w-0">
						<a
							href={rootMediaUrl}
							class="block truncate text-base font-semibold text-white transition-colors hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:text-lg"
						>
							{mediaTitle}
						</a>
						{#if seasonUrl && context.seasonNumber !== undefined}
							<div class="mt-1 flex items-center text-sm text-base-400">
								<a
									href={seasonUrl}
									class="transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
								>
									Season {context.seasonNumber}
								</a>
								{#if episodeUrl && context.episodeNumber !== undefined}
									<span>,&nbsp;</span>
									<a
										href={episodeUrl}
										class="transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
									>
										Episode {context.episodeNumber}
									</a>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</Container>
</main>
