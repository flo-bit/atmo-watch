<script lang="ts">
	import { resolve } from '$app/paths';
	import { loginDialog } from '$lib/login.svelte';
	import type { ReviewCommentModel } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import CommentComposer from './CommentComposer.svelte';

	type ThreadEntry = {
		comment: ReviewCommentModel;
		depth: number;
	};

	let {
		reviewUri,
		comments,
		viewerDid,
		viewerAvatarUrl,
		onCountChange
	}: {
		reviewUri: string;
		comments: ReviewCommentModel[];
		viewerDid: string | null;
		viewerAvatarUrl?: string;
		onCountChange?: (count: number) => void;
	} = $props();

	let createdComments = $state<ReviewCommentModel[]>([]);
	let replyingTo = $state<ReviewCommentModel | null>(null);
	let allComments = $derived([
		...comments,
		...createdComments.filter((created) => !comments.some((comment) => comment.uri === created.uri))
	]);
	let commentsByUri = $derived(new Map(allComments.map((comment) => [comment.uri, comment])));
	let entries = $derived(buildThread(allComments));

	const dateFormatter = new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'UTC'
	});

	$effect(() => {
		onCountChange?.(allComments.length);
	});

	function timestamp(comment: ReviewCommentModel) {
		const parsed = Date.parse(comment.createdAt);
		return Number.isNaN(parsed) ? 0 : parsed;
	}

	function buildThread(source: ReviewCommentModel[]): ThreadEntry[] {
		const byUri = Object.fromEntries(source.map((comment) => [comment.uri, comment]));
		const children: Record<string, ReviewCommentModel[]> = {};
		const roots: ReviewCommentModel[] = [];

		for (const comment of source) {
			if (comment.parentUri === reviewUri || !byUri[comment.parentUri]) {
				roots.push(comment);
				continue;
			}
			const siblings = children[comment.parentUri] ?? [];
			siblings.push(comment);
			children[comment.parentUri] = siblings;
		}

		roots.sort((left, right) => timestamp(right) - timestamp(left));
		for (const siblings of Object.values(children)) {
			siblings.sort((left, right) => timestamp(left) - timestamp(right));
		}

		const result: ThreadEntry[] = [];
		const visited: string[] = [];
		function append(comment: ReviewCommentModel, depth: number) {
			if (visited.includes(comment.uri)) return;
			visited.push(comment.uri);
			result.push({ comment, depth });
			for (const child of children[comment.uri] ?? []) append(child, depth + 1);
		}

		for (const root of roots) append(root, 0);
		for (const comment of source) append(comment, 0);
		return result;
	}

	function formatDate(value: string) {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
	}

	function handle(comment: ReviewCommentModel) {
		return comment.author.handle.replace(/^@/, '');
	}

	function authorLabel(comment: ReviewCommentModel) {
		if (comment.author.did === viewerDid) return 'You';
		return comment.author.displayName || `@${handle(comment)}`;
	}

	function startReply(comment: ReviewCommentModel) {
		if (!viewerDid) {
			loginDialog.show();
			return;
		}
		replyingTo = replyingTo?.uri === comment.uri ? null : comment;
	}

	function addComment(comment: ReviewCommentModel) {
		createdComments = [...createdComments, comment];
		replyingTo = null;
	}
</script>

<div class="mt-5">
	{#if viewerDid}
		<CommentComposer {reviewUri} {viewerDid} {viewerAvatarUrl} onCreated={addComment} />
	{:else}
		<button
			type="button"
			onclick={() => loginDialog.show()}
			class="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-base-300 transition-colors hover:border-white/15 hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
		>
			<span><strong class="font-semibold text-white">Log in</strong> to join the conversation.</span
			>
		</button>
	{/if}

	{#if entries.length > 0}
		<div class="mt-7 space-y-1">
			{#each entries as entry (entry.comment.uri)}
				{@const comment = entry.comment}
				{@const parent = commentsByUri.get(comment.parentUri)}
				<div
					class={entry.depth > 0 ? 'border-l border-white/10 pl-3' : ''}
					style={`margin-left: ${Math.min(entry.depth, 3) * 1.25}rem`}
				>
					<article class="flex gap-3 py-3">
						<a
							href={resolve('/profile/[actor]', { actor: comment.author.did })}
							class="h-fit shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
						>
							<Avatar
								src={comment.author.did === viewerDid
									? (viewerAvatarUrl ?? comment.author.avatarUrl)
									: comment.author.avatarUrl}
								alt={`@${handle(comment)}'s avatar`}
								class="size-8"
							/>
						</a>
						<div class="min-w-0 flex-1">
							<header class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
								<a
									href={resolve('/profile/[actor]', { actor: comment.author.did })}
									class="max-w-full truncate text-sm font-semibold text-white transition-colors hover:text-accent-300"
								>
									{authorLabel(comment)}
								</a>
								{#if comment.author.did !== viewerDid && comment.author.displayName}
									<span class="max-w-full truncate text-xs text-base-500">@{handle(comment)}</span>
								{/if}
								<span class="text-base-700" aria-hidden="true">·</span>
								<time datetime={comment.createdAt} class="text-xs text-base-500">
									{formatDate(comment.createdAt)}
								</time>
							</header>

							{#if parent && entry.depth > 1}
								<p class="mt-1 text-xs text-base-500">
									Replying to {parent.author.did === viewerDid ? 'you' : `@${handle(parent)}`}
								</p>
							{/if}

							<p class="mt-1.5 text-sm leading-6 break-words whitespace-pre-wrap text-base-200">
								{comment.text}
							</p>

							<button
								type="button"
								onclick={() => startReply(comment)}
								aria-expanded={replyingTo?.uri === comment.uri}
								class="mt-1.5 -ml-2 rounded-md px-2 py-1 text-xs font-semibold text-base-500 transition-colors hover:bg-white/[0.06] hover:text-base-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
							>
								Reply
							</button>
						</div>
					</article>

					{#if viewerDid && replyingTo?.uri === comment.uri}
						<div class="pb-4 pl-11">
							<CommentComposer
								{reviewUri}
								parent={comment}
								{viewerDid}
								{viewerAvatarUrl}
								autofocus={true}
								onCreated={addComment}
								onCancel={() => (replyingTo = null)}
							/>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="mt-6 text-sm text-base-500">No comments yet. Start the conversation.</p>
	{/if}
</div>
