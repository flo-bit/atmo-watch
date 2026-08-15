<script lang="ts">
	import { resolve } from '$app/paths';
	import { posterUrl } from '$lib/images';
	import type { Review as ReviewData } from '$lib/types';
	import { cn, slugify } from '$lib/utils';
	import Rating from './Rating.svelte';

	let {
		review,
		showItem = true,
		class: className
	}: {
		review: ReviewData;
		showItem?: boolean;
		class?: string;
	} = $props();

	let imageUrl = $derived(posterUrl(review.item.poster_path, 'w342'));
	let handle = $derived(review.author.handle.replace(/^@/, ''));
	let text = $derived(review.text.trim());
</script>

<article class={cn('flex gap-3 p-3 sm:gap-4 sm:p-4', className)}>
	{#if showItem}
		<a
			href={resolve('/[kind]/[id]', {
				kind: review.item.media_type,
				id: `${review.item.id}-${slugify(review.item.title)}`
			})}
			aria-label={review.item.title}
			class="block aspect-2/3 w-20 shrink-0 overflow-hidden rounded-md bg-base-900 transition-opacity hover:opacity-75 sm:w-24"
		>
			{#if imageUrl}
				<img
					src={imageUrl}
					alt={`Poster for ${review.item.title}`}
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
				<a
					href={resolve('/[kind]/[id]', {
						kind: review.item.media_type,
						id: `${review.item.id}-${slugify(review.item.title)}`
					})}
					class="line-clamp-2 font-semibold text-white transition-colors hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
				>
					{review.item.title}
				</a>
				<a
					href={resolve('/profile/[actor]', { actor: review.author.did })}
					class="mt-1 block truncate text-xs text-base-400 transition-colors hover:text-accent-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
				>
					@{handle}
				</a>
			</div>

			{#if text}
				<Rating rating={review.rating} size="size-3.5" />
			{/if}
		</header>

		{#if text}
			<p class="mt-3 text-sm leading-6 break-words whitespace-pre-wrap text-base-100">
				{text}
			</p>
		{:else}
			<div class="mt-4">
				<Rating rating={review.rating} size="size-6" />
			</div>
		{/if}
	</div>
</article>
