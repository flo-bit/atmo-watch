<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Container from '$lib/components/Container.svelte';
	import TrailerDialog from '$lib/components/TrailerDialog.svelte';
	import { calendarDayDifference, formatCalendarDate, relativeCalendarDate } from '$lib/dates';
	import { backdropUrl, posterUrl, stillUrl } from '$lib/images';
	import { slugify } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showId = $derived(`${data.show.tmdbId}-${slugify(data.show.title)}`);
	let showUrl = $derived(resolve('/[kind]/[id]', { kind: 'tv', id: showId }));
	let seasonPoster = $derived(data.season.poster ?? data.show.poster);
	let canonicalUrl = $derived(`${page.url.origin}${page.url.pathname}`);
	let seasonStatus = $derived(getSeasonStatus());
	let seasonDateRange = $derived(getSeasonDateRange());

	function formatRuntime(runtime: number | null) {
		return runtime ? `${runtime}m` : null;
	}

	function episodeCode(seasonNumber: number, episodeNumber: number) {
		return `S${seasonNumber} E${episodeNumber}`;
	}

	function getSeasonStatus() {
		const differences = data.episodes
			.map((episode) => calendarDayDifference(episode.airDate, data.today))
			.filter((difference): difference is number => difference !== null);
		if (differences.length === 0) return data.show.status === 'Planned' ? 'Upcoming' : null;
		if (differences.every((difference) => difference > 0)) return 'Upcoming';
		if (differences.some((difference) => difference >= 0)) return 'Airing';
		return 'Complete';
	}

	function getSeasonDateRange() {
		const dates = data.episodes
			.map((episode) => episode.airDate)
			.filter((date): date is string => Boolean(date))
			.sort();
		if (dates.length === 0) return data.season.airDate?.slice(0, 4) ?? null;
		const firstYear = dates[0].slice(0, 4);
		const lastYear = dates[dates.length - 1].slice(0, 4);
		return firstYear === lastYear ? firstYear : `${firstYear}–${lastYear}`;
	}

	function episodeDateText(airDate: string | null) {
		if (!airDate) return 'Air date TBA';
		const formatted = formatCalendarDate(airDate);
		const difference = calendarDayDifference(airDate, data.today);
		if (difference !== null && difference >= 0) {
			return `${formatted} · ${relativeCalendarDate(airDate, data.today)}`;
		}
		return formatted;
	}
</script>

<svelte:head>
	<title>{data.show.title}: {data.season.name} | atmo.watch</title>
	<meta
		name="description"
		content={data.season.overview ||
			`Episodes and release dates for ${data.show.title} ${data.season.name}.`}
	/>
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={`${data.show.title}: ${data.season.name} | atmo.watch`} />
	<meta
		property="og:description"
		content={data.season.overview ||
			`Episodes and release dates for ${data.show.title} ${data.season.name}.`}
	/>
	{#if seasonPoster}
		<meta property="og:image" content={posterUrl(seasonPoster, 'w780')} />
	{/if}
</svelte:head>

<main class="relative isolate min-h-dvh overflow-hidden bg-base-950 pb-16 text-white">
	{#if data.show.backdrop}
		<img
			src={backdropUrl(data.show.backdrop, 'w780')}
			alt=""
			class="pointer-events-none fixed inset-0 size-full object-cover object-center opacity-15"
		/>
	{/if}
	<div class="pointer-events-none fixed inset-0 bg-black/60"></div>

	<Container class="relative z-10 px-4 pt-8 sm:pt-12">
		<nav
			class="flex min-w-0 items-center gap-2 text-xs text-base-400 sm:text-sm"
			aria-label="Breadcrumb"
		>
			<a
				href={showUrl}
				class="truncate transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
			>
				{data.show.title}
			</a>
			<span class="text-base-600" aria-hidden="true">/</span>
			<span class="truncate text-base-200">{data.season.name}</span>
		</nav>

		{#if seasonPoster || data.trailer_url}
			<div
				class={`mt-6 gap-2 sm:gap-4 ${seasonPoster && data.trailer_url ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)]' : ''}`}
			>
				{#if seasonPoster}
					<img
						src={posterUrl(seasonPoster, 'w500')}
						alt="Poster for {data.season.name} of {data.show.title}"
						class={`aspect-2/3 rounded-xl border border-white/10 object-cover shadow-2xl shadow-black/30 ${data.trailer_url ? 'w-full' : 'w-36 sm:w-56'}`}
					/>
				{/if}

				{#if data.trailer_url}
					<div class={seasonPoster ? 'relative min-h-0 overflow-hidden' : 'aspect-video'}>
						<TrailerDialog
							url={data.trailer_url}
							title={`${data.show.title} ${data.season.name}`}
							variant="feature"
							fill={Boolean(seasonPoster)}
						/>
					</div>
				{/if}
			</div>
		{/if}

		<header class="mt-6 sm:mt-8">
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-300 sm:text-sm">
				{#if seasonStatus}<span>{seasonStatus}</span>{/if}
				{#if seasonStatus && seasonDateRange}
					<span class="text-base-600" aria-hidden="true">•</span>
				{/if}
				{#if seasonDateRange}<span>{seasonDateRange}</span>{/if}
				{#if seasonDateRange}<span class="text-base-600" aria-hidden="true">•</span>{/if}
				<span
					>{data.season.episodeCount}
					{data.season.episodeCount === 1 ? 'episode' : 'episodes'}</span
				>
				{#if data.network}
					<span class="text-base-600" aria-hidden="true">•</span>
					<span>{data.network}</span>
				{/if}
			</div>
			<h1 class="mt-1 text-3xl leading-tight font-semibold tracking-tight sm:text-5xl">
				{data.season.name}
			</h1>
			<p class="mt-1 text-sm font-medium text-base-300 sm:text-base">{data.show.title}</p>
		</header>

		{#if data.season.overview}
			<section class="mt-8 border-t border-white/10 pt-6">
				<h2 class="text-lg font-semibold tracking-tight">Overview</h2>
				<p class="mt-4 max-w-3xl text-sm leading-6 text-base-200 sm:text-base sm:leading-7">
					{data.season.overview}
				</p>
			</section>
		{/if}

		<section class="mt-10 border-t border-white/10 pt-6">
			<h2 class="text-lg font-semibold tracking-tight">Episodes</h2>

			{#if data.episodes.length > 0}
				<div class="mt-4 flex flex-col gap-7">
					{#each data.episodes as episode (episode.id)}
						{@const dayDifference = calendarDayDifference(episode.airDate, data.today)}
						{@const isUpcoming = dayDifference !== null && dayDifference >= 0}
						<article
							id={`episode-${episode.episodeNumber}`}
							class="scroll-mt-6 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4"
						>
							<div class="aspect-video overflow-hidden rounded-lg bg-base-900">
								{#if episode.still}
									<img
										src={stillUrl(episode.still, 'w300')}
										alt="Still from {episodeCode(
											episode.seasonNumber,
											episode.episodeNumber
										)} of {data.show.title}"
										loading="lazy"
										class="size-full object-cover"
									/>
								{:else}
									<div
										class="flex size-full items-center justify-center text-sm font-semibold text-base-600"
									>
										{episodeCode(episode.seasonNumber, episode.episodeNumber)}
									</div>
								{/if}
							</div>

							<div class="min-w-0 pt-3 sm:self-center sm:pt-0">
								<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-400">
									<span class="font-semibold text-base-200">
										{episodeCode(episode.seasonNumber, episode.episodeNumber)}
									</span>
									{#if episode.airDate}
										<span class="text-base-600" aria-hidden="true">•</span>
										<time datetime={episode.airDate}>{episodeDateText(episode.airDate)}</time>
									{/if}
									{#if formatRuntime(episode.runtime)}
										<span class="text-base-600" aria-hidden="true">•</span>
										<span>{formatRuntime(episode.runtime)}</span>
									{/if}
									{#if episode.episodeType === 'finale'}
										<span
											class="rounded-full bg-white/10 px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide text-base-200 uppercase"
										>
											Finale
										</span>
									{/if}
								</div>
								<h3 class="mt-1 text-base font-semibold tracking-tight text-white sm:text-lg">
									{episode.name || 'Episode title TBA'}
								</h3>
								{#if episode.overview && !isUpcoming}
									<p class="mt-2 line-clamp-3 text-sm leading-6 text-base-300">
										{episode.overview}
									</p>
								{:else if episode.overview && isUpcoming}
									<p class="mt-2 text-xs text-base-500">Synopsis hidden until the episode airs.</p>
								{/if}
							</div>
						</article>
					{/each}
				</div>
			{:else}
				<p class="mt-4 text-sm text-base-300">Episode information has not been announced yet.</p>
			{/if}
		</section>

		{#if data.previousSeason || data.nextSeason}
			<nav class="mt-10 grid grid-cols-2 gap-3 border-t border-white/10 pt-6" aria-label="Seasons">
				<div>
					{#if data.previousSeason}
						<a
							href={resolve('/[kind]/[id]/season/[season]', {
								kind: 'tv',
								id: showId,
								season: String(data.previousSeason.seasonNumber)
							})}
							class="block py-2 transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
						>
							<span class="text-xs text-base-500">Previous</span>
							<span class="mt-1 block text-sm font-semibold text-white"
								>← {data.previousSeason.name}</span
							>
						</a>
					{/if}
				</div>
				<div>
					{#if data.nextSeason}
						<a
							href={resolve('/[kind]/[id]/season/[season]', {
								kind: 'tv',
								id: showId,
								season: String(data.nextSeason.seasonNumber)
							})}
							class="block py-2 text-right transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
						>
							<span class="text-xs text-base-500">Next</span>
							<span class="mt-1 block text-sm font-semibold text-white"
								>{data.nextSeason.name} →</span
							>
						</a>
					{/if}
				</div>
			</nav>
		{/if}
	</Container>
</main>
