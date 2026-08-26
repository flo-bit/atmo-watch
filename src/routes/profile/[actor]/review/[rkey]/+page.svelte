<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Avatar from '$lib/components/Avatar.svelte';
	import CommentThread from '$lib/components/CommentThread.svelte';
	import Container from '$lib/components/Container.svelte';
	import MediaHero from '$lib/components/MediaHero.svelte';
	import Rating from '$lib/components/Rating.svelte';
	import { loginDialog } from '$lib/login.svelte';
	import { likeReview, unlikeReview } from '$lib/review-interactions.remote';
	import { slugify, toMediaRouteKind } from '$lib/utils';
	import { Heart, MessageCircle } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let liking = $state(false);
	let interactionError = $state('');
	// These are intentionally local snapshots so the like can update optimistically.
	// svelte-ignore state_referenced_locally
	let viewerLikeUri = $state(data.viewerLikeUri);
	// svelte-ignore state_referenced_locally
	let liked = $state(Boolean(data.viewerLikeUri));
	// svelte-ignore state_referenced_locally
	let likeCount = $state(data.likeCount);
	// svelte-ignore state_referenced_locally
	let threadCommentCount = $state(data.comments.length);
	let commentCount = $derived(Math.max(data.commentCount, threadCommentCount));
	let spoilerRevealed = $state(false);

	let releaseYear = $derived(data.mediaHeader?.item.releaseDate?.slice(0, 4) || null);
	let seasonLabel = $derived(
		data.mediaHeader?.item.numberOfSeasons
			? `${data.mediaHeader.item.numberOfSeasons} ${data.mediaHeader.item.numberOfSeasons === 1 ? 'season' : 'seasons'}`
			: null
	);
	let mediaFacts = $derived(
		[
			releaseYear,
			formatRuntime(data.mediaHeader?.item.runtime ?? null),
			data.review.media.creativeWorkType === 'tv_show' ? seasonLabel : null
		].filter((fact): fact is string => fact !== null)
	);
	let reviewText = $derived(data.review.text.trim());
	let spoilerHidden = $derived(
		data.review.containsSpoilers && Boolean(reviewText) && !spoilerRevealed
	);
	let reviewerHandle = $derived(data.review.author.handle.replace(/^@/, ''));
	let itemUrl = $derived(
		resolve('/[kind]/[id]', {
			kind: toMediaRouteKind(data.review.media.creativeWorkType),
			id: `${data.review.media.tmdbId}-${slugify(data.review.media.title)}`
		})
	);
	let profileUrl = $derived(resolve('/profile/[actor]', { actor: data.review.author.did }));
	let canonicalUrl = $derived(`${page.url.origin}${page.url.pathname}`);
	let ogImageUrl = $derived(
		`${canonicalUrl.replace(/\/$/, '')}/og.png${data.mediaHeader?.artworkRevision ? `?v=${encodeURIComponent(data.mediaHeader.artworkRevision)}` : ''}`
	);
	let socialTitle = $derived(
		reviewText
			? `${data.review.media.title} review by @${reviewerHandle}`
			: `${data.review.media.title} rated ${data.review.rating}/10 by @${reviewerHandle}`
	);
	let socialDescription = $derived(
		reviewText
			? `Read @${reviewerHandle}'s review of ${data.review.media.title}.`
			: `See @${reviewerHandle}'s ${data.review.rating}/10 rating of ${data.review.media.title}.`
	);

	const dateFormatter = new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeZone: 'UTC'
	});

	function formatDate(value: string) {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
	}

	function formatRuntime(runtime: number | null) {
		if (!runtime) return null;

		const hours = Math.floor(runtime / 60);
		const minutes = runtime % 60;
		if (!hours) return `${minutes}m`;
		return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
	}

	async function toggleLike() {
		interactionError = '';
		if (!data.did) {
			loginDialog.show();
			return;
		}
		if (liking) return;

		const previousLikeUri = viewerLikeUri;
		const wasLiked = liked;
		const previousLikeCount = likeCount;
		liked = !wasLiked;
		likeCount = wasLiked ? Math.max(0, likeCount - 1) : likeCount + 1;
		liking = true;

		try {
			if (wasLiked) {
				if (!previousLikeUri) throw new Error('Could not find your like.');
				await unlikeReview({ reviewUri: data.review.uri, likeUri: previousLikeUri });
				viewerLikeUri = null;
			} else {
				const result = await likeReview({ reviewUri: data.review.uri });
				viewerLikeUri = result.uri;
				if (!result.created) likeCount = previousLikeCount;
			}
		} catch (cause) {
			viewerLikeUri = previousLikeUri;
			liked = wasLiked;
			likeCount = previousLikeCount;
			interactionError = cause instanceof Error ? cause.message : 'Could not update like.';
		} finally {
			liking = false;
		}
	}
</script>

<svelte:head>
	<title>{socialTitle} | atmo.watch</title>
	<meta name="description" content={socialDescription} />

	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={socialTitle} />
	<meta property="og:description" content={socialDescription} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content={`@${reviewerHandle}'s ${data.review.rating}/10 rating of ${data.review.media.title}`}
	/>

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={socialTitle} />
	<meta name="twitter:description" content={socialDescription} />
	<meta name="twitter:image" content={ogImageUrl} />
	<meta
		name="twitter:image:alt"
		content={`@${reviewerHandle}'s ${data.review.rating}/10 rating of ${data.review.media.title}`}
	/>
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-16 text-base-50">
	<section class="relative isolate overflow-hidden">
		<MediaHero
			title={data.review.media.title}
			backdrop={data.mediaHeader?.item.backdrop}
			fallbackPoster={data.review.media.poster}
			logo={data.mediaHeader?.logo}
			href={itemUrl}
		/>

		{#if mediaFacts.length > 0}
			<div
				class="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 px-4 text-xs font-medium text-base-200 lg:text-sm"
			>
				{#each mediaFacts as fact, index (fact)}
					{#if index > 0}
						<span class="text-base-500" aria-hidden="true">•</span>
					{/if}
					<span>{fact}</span>
				{/each}
			</div>
		{/if}
	</section>

	<Container class="px-4 pt-5 sm:pt-6">
		<article class="mx-auto max-w-2xl">
			<div class="min-w-0">
				<a
					href={profileUrl}
					class="flex w-fit items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
				>
					<Avatar
						src={data.review.author.avatarUrl}
						alt={`@${reviewerHandle}'s avatar`}
						class="size-10 shrink-0"
					/>
					<span class="min-w-0">
						{#if data.review.author.displayName}
							<span class="block truncate text-sm font-semibold text-white">
								{data.review.author.displayName}
							</span>
						{/if}
						<span class="block truncate text-xs text-base-400">@{reviewerHandle}</span>
					</span>
				</a>

				<time datetime={data.review.createdAt} class="mt-3 block text-xs text-base-500">
					{formatDate(data.review.createdAt)}
				</time>

				<div class="mt-3">
					<Rating rating={data.review.rating} size="size-6" />
				</div>
			</div>

			<div class="mt-6">
				{#if reviewText}
					<div
						class={`relative ${spoilerHidden ? 'min-h-40 overflow-hidden rounded-xl bg-base-900/60' : ''}`}
					>
						<p
							class={`text-sm leading-6 break-words whitespace-pre-wrap text-base-100 ${spoilerHidden ? 'pointer-events-none opacity-30 blur-sm select-none' : ''}`}
							aria-hidden={spoilerHidden}
						>
							{reviewText}
						</p>

						{#if spoilerHidden}
							<button
								type="button"
								onclick={() => (spoilerRevealed = true)}
								class="absolute inset-0 flex size-full flex-col items-center justify-center gap-1 rounded-xl bg-base-950/65 px-5 text-center backdrop-blur-[2px] transition-colors hover:bg-base-950/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
							>
								<span class="text-sm font-semibold text-white"
									>This review may contain spoilers</span
								>
								<span class="text-xs text-base-400">Click to reveal</span>
							</button>
						{/if}
					</div>
				{:else}
					<p class="text-sm text-base-400">No written review.</p>
				{/if}

				<div class="mt-6 flex items-center gap-4 text-base-400">
					<button
						type="button"
						onclick={toggleLike}
						disabled={liking}
						aria-pressed={liked}
						aria-label={`${liked ? 'Unlike' : 'Like'} this review${likeCount > 0 ? `, ${likeCount} ${likeCount === 1 ? 'like' : 'likes'}` : ''}`}
						class={`inline-flex items-center gap-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400 disabled:cursor-wait ${
							liked ? 'text-accent-400 hover:text-accent-300' : 'hover:text-white'
						}`}
					>
						<Heart
							class="size-5"
							fill={liked ? 'currentColor' : 'none'}
							strokeWidth={1.5}
							aria-hidden="true"
						/>
						{#if likeCount > 0}<span>{likeCount}</span>{/if}
					</button>

					<a
						href="#comments-heading"
						aria-label={`${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`}
						class="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
					>
						<MessageCircle class="size-5" strokeWidth={1.5} aria-hidden="true" />
						{#if commentCount > 0}<span>{commentCount}</span>{/if}
					</a>
				</div>

				{#if interactionError}
					<p class="mt-3 text-sm text-red-300" role="status">{interactionError}</p>
				{/if}
			</div>
		</article>

		<section class="mx-auto mt-10 max-w-2xl" aria-labelledby="comments-heading">
			<h2 id="comments-heading" class="text-lg font-semibold text-white">
				Comments
				{#if commentCount > 0}
					<span class="ml-1 text-sm font-normal text-base-500">{commentCount}</span>
				{/if}
			</h2>

			{#key data.review.uri}
				<CommentThread
					reviewUri={data.review.uri}
					comments={data.comments}
					viewerDid={data.did}
					viewerAvatarUrl={data.avatarUrl}
					onCountChange={(count) => (threadCommentCount = count)}
				/>
			{/key}
		</section>
	</Container>
</main>
