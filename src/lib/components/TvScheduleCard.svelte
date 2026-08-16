<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatCalendarDate, relativeCalendarDate } from '$lib/dates';
	import { stillUrl } from '$lib/images';
	import type { MediaDetails, TvEpisodeSummary } from '$lib/types';
	import { slugify } from '$lib/utils';

	let {
		item,
		nextEpisode,
		today
	}: {
		item: MediaDetails;
		nextEpisode: TvEpisodeSummary;
		today: string;
	} = $props();

	let showId = $derived(`${item.tmdbId}-${slugify(item.title)}`);
	let relativeAirDate = $derived(relativeCalendarDate(nextEpisode.airDate, today));

	function formatRuntime(runtime: number | null) {
		return runtime ? `${runtime}m` : null;
	}

	function episodeLabel(episode: TvEpisodeSummary) {
		return `S${episode.seasonNumber} E${episode.episodeNumber}`;
	}
</script>

<section class="mt-6 border-t border-white/10 pt-5 text-sm text-white">
	<h2 class="text-sm font-semibold tracking-tight">Up next</h2>
	<a
		href={resolve(`/[kind]/[id]/season/[season]#episode-${nextEpisode.episodeNumber}`, {
			kind: 'tv',
			id: showId,
			season: String(nextEpisode.seasonNumber)
		})}
		class="group mt-3 flex items-center gap-3 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
	>
		{#if nextEpisode.still}
			<img
				src={stillUrl(nextEpisode.still, 'w300')}
				alt="Still from {episodeLabel(nextEpisode)} of {item.title}"
				class="aspect-video w-24 shrink-0 rounded-md object-cover sm:w-32"
			/>
		{/if}
		<div class="min-w-0 flex-1 py-1">
			<div
				class="flex flex-wrap items-center gap-x-2 text-[0.6875rem] font-semibold text-base-400 sm:text-xs"
			>
				<span class="text-accent-300">{episodeLabel(nextEpisode)}</span>
				{#if formatRuntime(nextEpisode.runtime)}
					<span class="text-base-600" aria-hidden="true">•</span>
					<span>{formatRuntime(nextEpisode.runtime)}</span>
				{/if}
			</div>
			<div class="mt-0.5 truncate text-sm font-semibold tracking-tight text-white sm:text-base">
				{nextEpisode.name || 'Episode title TBA'}
			</div>
			<div class="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-base-400">
				{#if nextEpisode.airDate}
					<span>Airs</span>
					<time datetime={nextEpisode.airDate}>
						{formatCalendarDate(nextEpisode.airDate, 'short')}
					</time>
					{#if relativeAirDate}
						<span class="text-base-600" aria-hidden="true">•</span>
						<span>{relativeAirDate}</span>
					{/if}
				{/if}
			</div>
		</div>
		<svg
			class="size-3.5 shrink-0 text-base-500 transition-transform group-hover:translate-x-0.5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			aria-hidden="true"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m9 18 6-6-6-6" />
		</svg>
	</a>
</section>
