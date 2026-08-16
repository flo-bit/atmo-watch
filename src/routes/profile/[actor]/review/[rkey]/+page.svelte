<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { oauthLogin } from '$lib/atproto/oauth.remote';
	import Avatar from '$lib/components/Avatar.svelte';
	import Container from '$lib/components/Container.svelte';
	import Rating from '$lib/components/Rating.svelte';
	import { posterUrl } from '$lib/images';
	import { likeReview, unlikeReview } from '$lib/review-interactions.remote';
	import { slugify, toMediaRouteKind } from '$lib/utils';
	import { AtprotoLoginModal } from '@foxui/social';
	import { Heart, Image as ImageIcon, MessageCircle } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let loginOpen = $state(false);
	let liking = $state(false);
	let interactionError = $state('');
	// These are intentionally local snapshots so the like can update optimistically.
	// svelte-ignore state_referenced_locally
	let viewerLikeUri = $state(data.viewerLikeUri);
	// svelte-ignore state_referenced_locally
	let liked = $state(Boolean(data.viewerLikeUri));
	// svelte-ignore state_referenced_locally
	let likeCount = $state(data.likeCount);
	let spoilerRevealed = $state(false);

	let imageUrl = $derived(posterUrl(data.review.media.poster, 'w342'));
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

	const dateFormatter = new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeZone: 'UTC'
	});

	function formatDate(value: string) {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
	}

	async function login(handle: string) {
		const returnTo = page.url.pathname + page.url.search + page.url.hash;
		const { url } = await oauthLogin({ handle: handle.trim(), returnTo });
		window.location.assign(url);
		return true;
	}

	async function toggleLike() {
		interactionError = '';
		if (!data.did) {
			loginOpen = true;
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
	<title>{data.review.media.title} review by @{reviewerHandle} | atmo.watch</title>
	<meta
		name="description"
		content={`Read @${reviewerHandle}'s review of ${data.review.media.title}.`}
	/>
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-16 text-base-50">
	<Container class="px-4 pt-8 sm:pt-12">
		<article
			class="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-x-5 gap-y-6 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-6"
		>
			<a
				href={itemUrl}
				class="aspect-2/3 overflow-hidden rounded-lg bg-base-900 shadow-2xl shadow-black/40 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
			>
				{#if imageUrl}
					<img
						src={imageUrl}
						alt={`Poster for ${data.review.media.title}`}
						class="size-full object-cover"
					/>
				{:else}
					<span class="flex size-full items-center justify-center text-base-600">
						<ImageIcon class="size-10" strokeWidth={1.5} aria-hidden="true" />
					</span>
				{/if}
			</a>

			<div class="min-w-0">
				<h1 class="text-xl leading-tight font-semibold text-white sm:text-2xl">
					<a href={itemUrl} class="transition-colors hover:text-accent-300">
						{data.review.media.title}
					</a>
				</h1>

				<div class="mt-3">
					<Rating rating={data.review.rating} size="size-4.5" />
				</div>

				<a
					href={profileUrl}
					class="mt-6 flex w-fit items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
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
			</div>

			<div class="col-span-2 sm:col-start-2 sm:col-end-3">
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
						aria-label={`${data.commentCount} ${data.commentCount === 1 ? 'comment' : 'comments'}`}
						class="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
					>
						<MessageCircle class="size-5" strokeWidth={1.5} aria-hidden="true" />
						{#if data.commentCount > 0}<span>{data.commentCount}</span>{/if}
					</a>
				</div>

				{#if interactionError}
					<p class="mt-3 text-sm text-red-300" role="status">{interactionError}</p>
				{/if}
			</div>
		</article>

		<section class="mt-10 sm:ml-[8.5rem]" aria-labelledby="comments-heading">
			<h2 id="comments-heading" class="text-lg font-semibold text-white">comments</h2>

			{#if data.comments.length > 0}
				<div class="mt-5 space-y-6">
					{#each data.comments as comment (comment.uri)}
						<article class="flex gap-3">
							<a href={resolve('/profile/[actor]', { actor: comment.author.did })} class="shrink-0">
								<Avatar
									src={comment.author.avatarUrl}
									alt={`@${comment.author.handle}'s avatar`}
									class="size-9"
								/>
							</a>
							<div class="min-w-0 flex-1">
								<header class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
									<a
										href={resolve('/profile/[actor]', { actor: comment.author.did })}
										class="truncate text-sm font-semibold text-white transition-colors hover:text-accent-300"
									>
										{comment.author.displayName || `@${comment.author.handle.replace(/^@/, '')}`}
									</a>
									{#if comment.author.displayName}
										<span class="truncate text-xs text-base-500">
											@{comment.author.handle.replace(/^@/, '')}
										</span>
									{/if}
									<span class="text-base-700" aria-hidden="true">·</span>
									<time datetime={comment.createdAt} class="text-xs text-base-500">
										{formatDate(comment.createdAt)}
									</time>
								</header>
								<p class="mt-2 text-sm leading-6 break-words whitespace-pre-wrap text-base-200">
									{comment.text}
								</p>
							</div>
						</article>
					{/each}
				</div>
			{:else}
				<p class="mt-4 text-sm text-base-500">No comments yet.</p>
			{/if}
		</section>
	</Container>
</main>

<AtprotoLoginModal bind:open={loginOpen} {login} />
