<script lang="ts">
	import { resolve } from '$app/paths';
	import { isCanonicalResourceUri, parseCanonicalResourceUri } from '@atcute/lexicons';
	import { EyeOff, Heart, Image as ImageIcon, MessageCircle } from '@lucide/svelte';
	import { posterUrl } from '$lib/images';
	import type { ReviewCardModel } from '$lib/types';
	import { cn, slugify, toMediaRouteKind } from '$lib/utils';
	import Avatar from './Avatar.svelte';
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

<article class={cn('flex gap-3 sm:gap-4', showItem ? 'p-3 sm:p-4' : 'py-3 sm:py-4', className)}>
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
					<ImageIcon class="size-8" strokeWidth={1.5} aria-hidden="true" />
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
						'group flex w-fit max-w-full items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400',
						showItem ? 'mt-1 text-xs' : 'text-sm'
					)}
				>
					<Avatar src={review.author.avatarUrl} alt="" class={showItem ? 'size-5' : 'size-7'} />
					<span class="min-w-0 truncate">
						{#if review.author.displayName}
							<span class="font-semibold text-white transition-colors group-hover:text-accent-300">
								{review.author.displayName}
							</span>
						{/if}
						<span
							class={cn(
								'transition-colors group-hover:text-accent-300',
								review.author.displayName ? 'ml-1.5 text-base-400' : 'font-semibold text-white'
							)}
						>
							@{handle}
						</span>
					</span>
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
						<EyeOff class="size-4 text-base-300" strokeWidth={1.5} aria-hidden="true" />
						<span class="text-xs font-semibold text-white">This review may contain spoilers</span>
						<span class="text-xs text-base-400">Click to show review</span>
					</button>
				{/if}
			</div>

			<a
				href={reviewUrl}
				aria-label={`Open review of ${review.media.title}`}
				class="mt-3 flex w-fit items-center gap-3 text-xs text-base-500 transition-colors hover:text-base-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
			>
				<span
					class="inline-flex items-center gap-1"
					aria-label={`${review.likeCount} ${review.likeCount === 1 ? 'like' : 'likes'}`}
				>
					<Heart class="size-4" strokeWidth={1.5} aria-hidden="true" />
					{#if review.likeCount > 0}<span>{review.likeCount}</span>{/if}
				</span>

				<span
					class="inline-flex items-center gap-1"
					aria-label={`${review.commentCount} ${review.commentCount === 1 ? 'comment' : 'comments'}`}
				>
					<MessageCircle class="size-4" strokeWidth={1.5} aria-hidden="true" />
					{#if review.commentCount > 0}<span>{review.commentCount}</span>{/if}
				</span>
			</a>
		{:else}
			<div class="mt-4">
				<Rating rating={review.rating} size="size-6" />
			</div>
		{/if}
	</div>
</article>
