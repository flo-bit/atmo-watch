<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Send } from '@lucide/svelte';
	import { isCanonicalResourceUri, parseCanonicalResourceUri } from '@atcute/lexicons';
	import { createReviewComment } from '$lib/comment-write.remote';
	import type { ReviewCardModel, ReviewCommentModel } from '$lib/types';
	import Avatar from './Avatar.svelte';

	let {
		reviewUri,
		parent = null,
		viewerDid,
		viewerAvatarUrl,
		autofocus = false,
		onCreated,
		onCancel
	}: {
		reviewUri: ReviewCardModel['uri'];
		parent?: ReviewCommentModel | null;
		viewerDid: string;
		viewerAvatarUrl?: string;
		autofocus?: boolean;
		onCreated: (comment: ReviewCommentModel) => void;
		onCancel?: () => void;
	} = $props();

	let text = $state('');
	let posting = $state(false);
	let commentError = $state('');
	let textarea = $state<HTMLTextAreaElement>();
	let parentHandle = $derived(parent?.author.handle.replace(/^@/, '') ?? '');
	let placeholder = $derived(parent ? `Reply to @${parentHandle}…` : 'Add a comment…');

	$effect(() => {
		if (!autofocus || !textarea) return;
		const frame = window.requestAnimationFrame(() => textarea?.focus());
		return () => window.cancelAnimationFrame(frame);
	});

	function replyRoot(comment: ReviewCommentModel) {
		const rootUri = comment.rootUri;
		if (
			rootUri &&
			isCanonicalResourceUri(rootUri) &&
			parseCanonicalResourceUri(rootUri).collection === 'social.popfeed.feed.comment'
		) {
			return rootUri;
		}
		return comment.uri;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && onCancel) {
			event.preventDefault();
			onCancel();
			return;
		}
		if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return;
		event.preventDefault();
		(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
	}

	async function postComment(event: SubmitEvent) {
		event.preventDefault();
		if (!text.trim() || posting) return;

		posting = true;
		commentError = '';

		try {
			const result = await createReviewComment({
				reviewUri,
				...(parent
					? {
							parentUri: parent.uri,
							rootUri: replyRoot(parent)
						}
					: {}),
				text
			});
			onCreated({
				uri: result.uri,
				author: {
					did: viewerDid,
					handle: viewerDid,
					avatarUrl: viewerAvatarUrl
				},
				text: result.text,
				createdAt: result.createdAt,
				parentUri: result.parentUri,
				rootUri: result.rootUri
			});
			text = '';
			void invalidateAll();
		} catch (cause) {
			commentError = cause instanceof Error ? cause.message : 'Could not post comment.';
		} finally {
			posting = false;
		}
	}
</script>

<form onsubmit={postComment} class="flex items-start gap-3">
	<Avatar src={viewerAvatarUrl} alt="" class={parent ? 'size-7 shrink-0' : 'size-9 shrink-0'} />
	<div class="min-w-0 flex-1">
		<div
			class="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] transition-colors focus-within:border-accent-500/50 focus-within:bg-white/[0.06]"
		>
			<label for={parent ? `reply-${parent.uri}` : `comment-${reviewUri}`} class="sr-only">
				{parent ? `Reply to @${parentHandle}` : 'Add a comment'}
			</label>
			<textarea
				bind:this={textarea}
				id={parent ? `reply-${parent.uri}` : `comment-${reviewUri}`}
				bind:value={text}
				oninput={() => (commentError = '')}
				onkeydown={handleKeydown}
				disabled={posting}
				rows={parent ? 2 : 3}
				maxlength="1000"
				{placeholder}
				class="block w-full resize-none border-0 bg-transparent px-3 pt-2.5 pb-2 text-sm leading-6 text-white shadow-none ring-0 outline-none placeholder:text-base-500 focus:border-0 focus:ring-0 disabled:cursor-wait disabled:opacity-60"
			></textarea>

			<div
				class="flex min-h-10 items-center justify-between gap-3 border-t border-white/[0.07] px-2.5"
			>
				<span class="text-[0.625rem] text-base-600">
					{#if text.length >= 800}{text.length}/1000{:else}⌘ Enter to post{/if}
				</span>
				<div class="flex items-center gap-2">
					{#if onCancel}
						<button
							type="button"
							onclick={onCancel}
							disabled={posting}
							class="h-7 rounded-full px-2.5 text-xs font-semibold text-base-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
						>
							Cancel
						</button>
					{/if}
					<button
						type="submit"
						disabled={!text.trim() || posting}
						class="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-500 px-3 text-xs font-bold text-white transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-40"
					>
						<Send class="size-3" strokeWidth={2} aria-hidden="true" />
						{posting ? 'Posting…' : parent ? 'Reply' : 'Comment'}
					</button>
				</div>
			</div>
		</div>

		{#if commentError}
			<p class="mt-2 text-xs text-red-300" role="alert">{commentError}</p>
		{/if}
	</div>
</form>
