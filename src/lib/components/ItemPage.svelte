<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Avatar from './Avatar.svelte';
	import Container from './Container.svelte';
	import ExternalRatings from './ExternalRatings.svelte';
	import ItemsGrid from './ItemsGrid.svelte';
	import Review from './Review.svelte';
	import TabSelect from './TabSelect.svelte';
	import TrailerDialog from './TrailerDialog.svelte';
	import { backdropUrl, posterUrl, profileUrl } from '$lib/images';
	import { reviewDialog } from '$lib/review.svelte';
	import { slugify } from '$lib/utils';
	import type { getMediaPage } from '$lib/tmdb.server';
	import type { Review as ReviewData } from '$lib/types';

	type DetailSection = 'reviews' | 'similar' | 'cast';
	type ItemPageData = Awaited<ReturnType<typeof getMediaPage>> & { reviews: ReviewData[] };

	let { data }: { data: ItemPageData } = $props();
	let canonicalUrl = $derived(`${page.url.origin}${page.url.pathname}`);
	let ogImageUrl = $derived(`${canonicalUrl.replace(/\/$/, '')}/og.png`);
	let selectedSection = $state<DetailSection>('similar');
	let detailTabs = $derived(
		[
			data.reviews.length > 0 ? { value: 'reviews' as const, label: 'reviews' } : null,
			data.recommendations.length > 0 ? { value: 'similar' as const, label: 'similar' } : null,
			data.cast.length > 0 ? { value: 'cast' as const, label: 'cast' } : null
		].filter((option): option is { value: DetailSection; label: string } => option !== null)
	);

	$effect(() => {
		if (detailTabs.length > 0 && !detailTabs.some((tab) => tab.value === selectedSection)) {
			selectedSection = detailTabs[0].value;
		}
	});
</script>

<svelte:head>
	<title>{data.item.title} | atmo.watch</title>
	<meta name="description" content={`Rate and review "${data.item.title}" on atmo.watch`} />

	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={`${data.item.title} | atmo.watch`} />
	<meta property="og:description" content={`Rate and review "${data.item.title}" on atmo.watch`} />
	<meta property="og:image" content={ogImageUrl} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta property="twitter:domain" content="atmo.watch" />
	<meta property="twitter:url" content={canonicalUrl} />
	<meta name="twitter:title" content={`${data.item.title} | atmo.watch`} />
	<meta name="twitter:description" content={`Rate and review "${data.item.title}" on atmo.watch`} />
	<meta name="twitter:image" content={ogImageUrl} />
</svelte:head>

{#if data.item.backdrop_path}
	<img
		src={backdropUrl(data.item.backdrop_path, 'w780')}
		alt=""
		class="fixed h-full w-full object-cover object-center opacity-20"
	/>
{/if}
<div class="fixed inset-0 h-full w-full bg-black/50"></div>

<Container class="relative z-10 pt-4 pb-8">
	<div class="flex gap-4 px-4 pt-8">
		{#if data.item.poster_path}
			<img
				src={posterUrl(data.item.poster_path, 'w500')}
				alt="Poster for {data.item.title}"
				class="h-36 w-24 shrink-0 rounded-lg border border-white/10 object-cover sm:h-64 sm:w-44"
			/>
		{/if}

		<div class="flex min-w-0 flex-col gap-4">
			<h1 class="max-w-xl text-3xl font-semibold text-white sm:text-4xl">
				{data.item.title}
			</h1>
			<ExternalRatings
				imdbId={data.imdb_id}
				imdbVotes={data.imdb_votes}
				ratings={data.ratings}
				streaming={data.streaming}
			/>
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onclick={() => reviewDialog.show(data.item)}
					class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
				>
					<svg
						class="size-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="m12 3.75 2.47 5.004 5.522.803-3.996 3.895.943 5.5L12 16.354l-4.939 2.598.943-5.5-3.996-3.895 5.522-.803L12 3.75Z"
						/>
					</svg>
					review
				</button>
				{#if data.trailer_url}
					<TrailerDialog url={data.trailer_url} title={data.item.title} />
				{/if}
			</div>
		</div>
	</div>

	<div class="px-4 pt-4 text-sm text-white">
		<section class="mb-4 max-w-2xl">
			<h2 class="mb-2 text-lg font-semibold">overview</h2>
			<p>{data.item.overview}</p>
		</section>
	</div>

	{#if detailTabs.length > 0}
		<section class="px-4 pt-4 pb-8 text-sm text-white">
			<h2 class="sr-only">More about {data.item.title}</h2>
			<TabSelect bind:value={selectedSection} options={detailTabs} label="Choose detail section" />

			{#if selectedSection === 'reviews' && data.reviews.length > 0}
				<div class="mt-4 flex max-w-2xl flex-col gap-4">
					{#each data.reviews as review (review.uri)}
						<Review {review} showItem={false} />
					{/each}
				</div>
			{:else if selectedSection === 'similar' && data.recommendations.length > 0}
				<ItemsGrid items={data.recommendations} class="mt-4" />
			{:else if selectedSection === 'cast' && data.cast.length > 0}
				<div class="mt-4 grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-5">
					{#each data.cast as castMember (castMember.id)}
						<a
							href={resolve('/cast/[id]', {
								id: `${castMember.id}-${slugify(castMember.name)}`
							})}
							class="flex min-w-0 flex-col items-center gap-1.5 transition-opacity hover:opacity-75"
						>
							<Avatar
								src={profileUrl(castMember.profile_path, 'h632')}
								alt={castMember.name}
								class="aspect-square w-full"
							/>
							<span class="line-clamp-2 text-center text-xs font-medium">{castMember.name}</span>
							<span class="line-clamp-2 text-center text-xs text-base-400"
								>{castMember.character}</span
							>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</Container>
