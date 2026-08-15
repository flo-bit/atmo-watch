<script lang="ts">
	import { resolve } from '$app/paths';
	import { isCanonicalResourceUri, parseCanonicalResourceUri } from '@atcute/lexicons';
	import { posterUrl } from '$lib/images';
	import type { ReviewCardModel } from '$lib/types';
	import { cn, slugify, toMediaRouteKind } from '$lib/utils';
	import Rating from './Rating.svelte';

	let {
		review,
		showItem = true,
		class: className
	}: {
		review: ReviewCardModel;
		showItem?: boolean;
		class?: string;
	} = $props();

	let imageUrl = $derived(posterUrl(review.media.poster, 'w342'));
	let itemUrl = $derived(
		resolve('/[kind]/[id]', {
			kind: toMediaRouteKind(review.media.creativeWorkType),
			id: `${review.media.tmdbId}-${slugify(review.media.title)}`
		})
	);
	let handle = $derived(review.author.handle.replace(/^@/, ''));
	let reviewUrl = $derived.by(() => {
		if (!isCanonicalResourceUri(review.uri)) return undefined;
		const parsed = parseCanonicalResourceUri(review.uri);
		if (parsed.collection !== 'social.popfeed.feed.review') return undefined;
		return resolve('/profile/[actor]/review/[rkey]', {
			actor: review.author.did,
			rkey: parsed.rkey
		});
	});
	let text = $derived(review.text.trim());
	let hasSpoilerText = $derived(review.containsSpoilers && Boolean(text));
	let spoilerRevealed = $state(false);
	let spoilerHidden = $derived(hasSpoilerText && !spoilerRevealed);
</script>

<article class={cn('flex gap-3 p-3 sm:gap-4 sm:p-4', className)}>
	{#if showItem}
		<a
			href={itemUrl}
			aria-label={review.media.title}
			class="block aspect-2/3 w-16 shrink-0 self-start overflow-hidden rounded-md bg-base-900 transition-opacity hover:opacity-75 sm:w-20"
		>
			{#if imageUrl}
				<img
					src={imageUrl}
					alt={`Poster for ${review.media.title}`}
					class="size-full object-cover"
					loading="lazy"
				/>
			{:else}
				<span class="flex size-full items-center justify-center text-base-600">
					<svg
						class="size-8"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="m6 20.25 6-10.5 6 10.5m-12 0h12M5.25 6.75h13.5A2.25 2.25 0 0 1 21 9v9a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18V9a2.25 2.25 0 0 1 2.25-2.25ZM8.25 3.75h7.5"
						/>
					</svg>
				</span>
			{/if}
		</a>
	{/if}

	<div class="min-w-0 flex-1 py-0.5">
		<header class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				{#if showItem}
					<a
						href={itemUrl}
						class="line-clamp-2 font-semibold text-white transition-colors hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
					>
						{review.media.title}
					</a>
				{/if}
				<a
					href={resolve('/profile/[actor]', { actor: review.author.did })}
					class={cn(
						'block truncate transition-colors hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400',
						showItem ? 'mt-1 text-xs text-base-400' : 'text-sm font-semibold text-white'
					)}
				>
					@{handle}
				</a>
			</div>

			{#if text}
				<Rating rating={review.rating} size="size-3.5" />
			{/if}
		</header>

		{#if text}
			<div
				class={cn(
					'relative mt-3',
					hasSpoilerText && 'min-h-24',
					spoilerHidden && 'overflow-hidden rounded-lg bg-base-900/60'
				)}
			>
				<p
					class={cn(
						'text-sm leading-6 break-words whitespace-pre-wrap text-base-100',
						spoilerHidden && 'pointer-events-none opacity-35 blur-sm select-none'
					)}
					aria-hidden={spoilerHidden}
				>
					{text}
				</p>

				{#if spoilerHidden}
					<button
						type="button"
						onclick={() => (spoilerRevealed = true)}
						class="absolute inset-0 flex size-full flex-col items-center justify-center gap-1 rounded-lg bg-base-950/65 px-4 text-center backdrop-blur-[2px] transition-colors hover:bg-base-950/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
					>
						<svg
							class="size-4 text-base-300"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9.3 4.7 9.8 5.4a1 1 0 0 1 0 1.2 17.8 17.8 0 0 1-3 3.2M6.2 6.2A17.5 17.5 0 0 0 2.2 9.4a1 1 0 0 0 0 1.2C2.7 11.3 6.5 16 12 16c.8 0 1.6-.1 2.3-.3"
							/>
						</svg>
						<span class="text-xs font-semibold text-white">This review may contain spoilers</span>
						<span class="text-xs text-base-400">Click to show review</span>
					</button>
				{/if}
			</div>

			{#if reviewUrl}
				<a
					href={reviewUrl}
					class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-base-400 transition-colors hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
				>
					view review
					<svg
						class="size-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6" />
					</svg>
				</a>
			{/if}
		{:else}
			<div class="mt-4">
				<Rating rating={review.rating} size="size-6" />
			</div>
		{/if}
	</div>
</article>
