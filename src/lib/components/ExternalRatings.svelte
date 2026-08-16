<script lang="ts">
	import popfeedIcon from '$lib/icons/popfeed.svg';
	import type { ExternalRating } from '$lib/types';

	let {
		popfeedScore,
		popfeedRatingCount,
		imdbId,
		imdbVotes,
		ratings
	}: {
		popfeedScore: number | null;
		popfeedRatingCount: number;
		imdbId: string | null;
		imdbVotes: string | null;
		ratings: ExternalRating[];
	} = $props();

	let imdbRating = $derived(ratings.find((rating) => rating.source === 'Internet Movie Database'));
	let imdbScore = $derived(imdbRating?.value.replace(/\/10$/, ''));
	let compactImdbVotes = $derived(formatCount(imdbVotes));
	let compactPopfeedRatings = $derived(formatCount(String(popfeedRatingCount)));
	let rottenTomatoesRating = $derived(
		ratings.find((rating) => rating.source === 'Rotten Tomatoes')
	);

	function formatCount(value: string | null) {
		if (!value) return null;

		const count = Number(value.replaceAll(',', ''));
		if (!Number.isFinite(count)) return value;

		const compact = (amount: number) =>
			new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(amount);

		if (count >= 1_000_000) return `${compact(count / 1_000_000)}M`;
		if (count >= 1_000) return `${compact(count / 1_000)}k`;
		return String(count);
	}
</script>

{#if popfeedScore !== null || (imdbId && (imdbScore || compactImdbVotes)) || rottenTomatoesRating}
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2 lg:gap-x-5" aria-label="Ratings">
		{#if popfeedScore !== null}
			<div
				class="inline-flex items-center gap-1.5"
				aria-label={`Popfeed rating: ${popfeedScore.toFixed(1)} out of 10 from ${popfeedRatingCount} ${popfeedRatingCount === 1 ? 'rating' : 'ratings'}`}
			>
				<span
					class="inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-accent-400 lg:size-5"
					aria-hidden="true"
				>
					<img src={popfeedIcon} alt="" class="size-3.5 lg:size-4" />
				</span>
				<span class="text-xs font-semibold tabular-nums lg:text-sm">{popfeedScore.toFixed(1)}</span>
				{#if compactPopfeedRatings}
					<span class="text-[0.625rem] text-base-400 tabular-nums lg:text-xs">
						({compactPopfeedRatings})
					</span>
				{/if}
			</div>
		{/if}

		{#if imdbId && (imdbScore || compactImdbVotes)}
			<a
				href={`https://www.imdb.com/title/${imdbId}/`}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-1.5 text-base-200 transition-colors hover:text-white"
				aria-label={`View on IMDb${imdbScore ? `. Rating: ${imdbScore} out of 10` : ''}${imdbVotes ? `. ${imdbVotes} votes` : ''}`}
			>
				<span
					class="inline-flex h-4 items-center rounded-sm bg-[#f5c518] px-1 text-[0.45rem] font-black tracking-tight text-black lg:h-5 lg:text-[0.5rem]"
				>
					IMDb
				</span>
				{#if imdbScore}
					<span class="text-xs font-semibold tabular-nums lg:text-sm">{imdbScore}</span>
				{/if}
				{#if compactImdbVotes}
					<span class="text-[0.625rem] text-base-400 tabular-nums lg:text-xs">
						({compactImdbVotes})
					</span>
				{/if}
			</a>
		{/if}

		{#if rottenTomatoesRating}
			<div
				class="inline-flex items-center gap-1.5"
				aria-label={`Rotten Tomatoes rating: ${rottenTomatoesRating.value}`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="size-4 shrink-0 lg:size-5"
					viewBox="0 0 512 512"
					aria-hidden="true"
				>
					<path d="M0 0h512v512H0z" fill="none" />
					<path
						fill="#f93208"
						d="M395.5 103.4q1.5 2.25 2.4 4.5c-41.7-16.4-105.3 39.5-158.9 8.9c0 57.2-48 63.3-75.7 65c7.9-19 21.3-38 5.6-57c-25.7 27.6-47.4 38.2-103.3 24.2c-98.8 103.8-45.3 226.7-15.7 267.4c134.1 159.6 353 96.4 425.6-22.5c17.7-30.5 82.9-195.9-80-290.5"
					/>
					<path
						fill="#02902e"
						d="M145.1 20.1L179.2 0l25.7 58.9c14.4-24.1 52.5-62.1 94.9-17.8c-18 4.8-28.6 14.7-29.4 32.2C328 57.4 389.6 85.5 398 107.9c-41.7-16.4-105.3 39.5-158.9 8.9c0 57.2-48 63.3-75.7 65c7.9-19 21.3-38 5.6-57c-29 31.1-52.8 40.6-126.2 17.8c18.5-6.4 56.5-43.3 93-43.5c-25.9-9.4-46.8-8-67.8-5.6c11.1-15.1 46.2-57.8 108.9-32.2z"
					/>
				</svg>
				<span class="text-xs font-semibold tabular-nums lg:text-sm">
					{rottenTomatoesRating.value}
				</span>
			</div>
		{/if}
	</div>
{/if}
