<script lang="ts">
	import { resolve } from '$app/paths';
	import { calendarDayDifference, formatCalendarDate } from '$lib/dates';
	import { posterUrl } from '$lib/images';
	import type { MediaDetails, TvEpisodeSummary, TvSeasonSummary } from '$lib/types';
	import { slugify } from '$lib/utils';

	let {
		item,
		seasons,
		nextEpisode,
		today
	}: {
		item: MediaDetails;
		seasons: readonly TvSeasonSummary[];
		nextEpisode: TvEpisodeSummary | null;
		today: string;
	} = $props();

	let showAllSeasons = $state(false);
	let orderedSeasons = $derived([
		...seasons
			.filter((season) => season.seasonNumber > 0)
			.sort((left, right) => left.seasonNumber - right.seasonNumber),
		...seasons.filter((season) => season.seasonNumber === 0)
	]);
	let showMoreClass = $derived(
		orderedSeasons.length > 10 ? '' : orderedSeasons.length > 6 ? 'lg:hidden' : 'sm:hidden'
	);
	let showId = $derived(`${item.tmdbId}-${slugify(item.title)}`);

	$effect(() => {
		if (item.tmdbId > 0) showAllSeasons = false;
	});

	function seasonLayoutClass(index: number) {
		if (showAllSeasons || index < 4) return 'block';
		if (index < 6) return 'hidden sm:block';
		if (index < 10) return 'hidden lg:block';
		return 'hidden';
	}

	function seasonStatus(season: TvSeasonSummary) {
		const difference = calendarDayDifference(season.airDate, today);
		if (difference !== null && difference > 0) return 'Upcoming';
		if (nextEpisode?.seasonNumber === season.seasonNumber) return 'Airing';
		return null;
	}

	function seasonDate(season: TvSeasonSummary) {
		if (!season.airDate) return null;
		if ((calendarDayDifference(season.airDate, today) ?? 0) > 0) {
			return `Premieres ${formatCalendarDate(season.airDate, 'short')}`;
		}
		return season.airDate.slice(0, 4);
	}
</script>

{#if orderedSeasons.length > 0}
	<section class="mt-10 border-t border-white/10 pt-6 text-sm text-white">
		<h2 class="text-lg font-semibold tracking-tight">Seasons</h2>
		<div class="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5">
			{#each orderedSeasons as season, index (season.id)}
				<a
					href={resolve('/[kind]/[id]/season/[season]', {
						kind: 'tv',
						id: showId,
						season: String(season.seasonNumber)
					})}
					class={`${seasonLayoutClass(index)} group min-w-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70`}
				>
					<div
						class="relative aspect-2/3 overflow-hidden rounded-lg border border-white/10 bg-base-900"
					>
						{#if season.poster || item.poster}
							<img
								src={posterUrl(season.poster ?? item.poster, 'w342')}
								alt="Poster for {season.name || `Season ${season.seasonNumber}`} of {item.title}"
								loading="lazy"
								class="size-full object-cover transition duration-300 group-hover:scale-[1.02] group-hover:opacity-85 motion-reduce:transition-none"
							/>
						{/if}
						{#if seasonStatus(season)}
							<span
								class="absolute top-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[0.625rem] font-semibold tracking-wide text-white uppercase backdrop-blur-sm"
							>
								{seasonStatus(season)}
							</span>
						{/if}
					</div>
					<h3 class="mt-2 line-clamp-2 text-sm font-semibold text-white">
						{season.name || `Season ${season.seasonNumber}`}
					</h3>
					<div class="mt-1 flex flex-wrap gap-x-1.5 text-xs text-base-400">
						{#if seasonDate(season)}
							<span>{seasonDate(season)}</span>
						{/if}
						{#if seasonDate(season) && season.episodeCount > 0}
							<span class="text-base-600" aria-hidden="true">•</span>
						{/if}
						{#if season.episodeCount > 0}
							<span>{season.episodeCount} {season.episodeCount === 1 ? 'episode' : 'episodes'}</span
							>
						{/if}
					</div>
				</a>
			{/each}
		</div>

		{#if !showAllSeasons && orderedSeasons.length > 4}
			<button
				type="button"
				onclick={() => (showAllSeasons = true)}
				class={`mt-5 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${showMoreClass}`}
			>
				show all seasons
				<svg
					class="size-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.8"
						d="m6 9 6 6 6-6"
					/>
				</svg>
			</button>
		{/if}
	</section>
{/if}
