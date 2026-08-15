<script lang="ts">
	import { logoUrl } from '$lib/images';
	import type { ExternalRating, StreamingAvailability } from '$lib/types';

	let {
		imdbId,
		imdbVotes,
		ratings,
		streaming
	}: {
		imdbId: string | null;
		imdbVotes: string | null;
		ratings: ExternalRating[];
		streaming: StreamingAvailability | null;
	} = $props();

	let imdbRating = $derived(ratings.find((rating) => rating.source === 'Internet Movie Database'));
	let imdbScore = $derived(imdbRating?.value.replace(/\/10$/, ''));
	let compactImdbVotes = $derived(formatVotes(imdbVotes));
	let rottenTomatoesRating = $derived(
		ratings.find((rating) => rating.source === 'Rotten Tomatoes')
	);

	function formatVotes(value: string | null) {
		if (!value) return null;

		const votes = Number(value.replaceAll(',', ''));
		if (!Number.isFinite(votes)) return value;

		const compact = (amount: number) =>
			new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(amount);

		if (votes >= 1_000_000) return `${compact(votes / 1_000_000)}M`;
		if (votes >= 1_000) return `${compact(votes / 1_000)}k`;
		return String(votes);
	}
</script>

{#if (imdbId && (imdbScore || compactImdbVotes)) ||
	rottenTomatoesRating ||
	(streaming && streaming.providers.length > 0)}
	<div class="flex flex-col items-start gap-2">
		{#if (imdbId && (imdbScore || compactImdbVotes)) || rottenTomatoesRating}
			<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
				{#if imdbId && (imdbScore || compactImdbVotes)}
					<a
						href={`https://www.imdb.com/title/${imdbId}/`}
						target="_blank"
						rel="noopener noreferrer"
						class="text-base-200 inline-flex items-center gap-1.5 text-xs transition-colors hover:text-white"
						aria-label={`View on IMDb${imdbScore ? `. Rating: ${imdbScore} out of 10` : ''}${imdbVotes ? `. ${imdbVotes} votes` : ''}`}
					>
						<span
							class="rounded-sm bg-[#f5c518] px-1 py-px text-[0.55rem] font-black tracking-tight text-black"
						>
							IMDb
						</span>
						{#if imdbScore}
							<span class="font-medium tabular-nums">{imdbScore}</span>
						{/if}
						{#if compactImdbVotes}
							<span class="text-base-400 text-[0.65rem] tabular-nums">({compactImdbVotes})</span>
						{/if}
					</a>
				{/if}

				{#if rottenTomatoesRating}
					<div
						class="text-base-200 inline-flex items-center gap-1 text-xs"
						aria-label={`Rotten Tomatoes rating: ${rottenTomatoesRating.value}`}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="size-4 shrink-0"
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

						<span class="font-medium tabular-nums">{rottenTomatoesRating.value}</span>
					</div>
				{/if}
			</div>
		{/if}

		{#if streaming && streaming.providers.length > 0}
			<div
				class="flex flex-wrap items-center gap-1.5"
				title={`Streaming providers in ${streaming.region_name}`}
			>
				<span class="text-base-300 mr-0.5 text-xs">stream on</span>
				{#each streaming.providers as provider (provider.id)}
					{#if streaming.link}
						<a
							href={streaming.link}
							target="_blank"
							rel="external noopener noreferrer"
							aria-label={`${provider.name} streaming options in ${streaming.region_name}`}
							title={`${provider.name} · ${streaming.region_name}`}
							class="rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
						>
							<img
								src={logoUrl(provider.logo_path, 'w92')}
								alt=""
								class="size-6 rounded-md object-cover"
							/>
						</a>
					{:else}
						<img
							src={logoUrl(provider.logo_path, 'w92')}
							alt={provider.name}
							title={`${provider.name} · ${streaming.region_name}`}
							class="size-6 rounded-md object-cover"
						/>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/if}
