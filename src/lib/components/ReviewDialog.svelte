<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Dialog } from 'bits-ui';
	import { untrack } from 'svelte';
	import { X } from '@lucide/svelte';
	import { posterUrl } from '$lib/images';
	import { reviewDialog } from '$lib/review.svelte';
	import { loadReviewDraft, saveReviewRecord } from '$lib/review-write.remote';
	import RatingInput from './RatingInput.svelte';

	let rating = $state(0);
	let review = $state('');
	let containsSpoilers = $state(false);
	let loading = $state(false);
	let saving = $state(false);
	let saved = $state(false);
	let reviewError = $state('');

	$effect(() => {
		const item = reviewDialog.item;
		if (!reviewDialog.open || !item) return;

		rating = 0;
		review = '';
		containsSpoilers = false;
		loading = true;
		saving = false;
		saved = false;
		reviewError = '';

		let cancelled = false;
		const request = untrack(() =>
			loadReviewDraft({
				creativeWorkType: item.creativeWorkType,
				tmdbId: item.tmdbId
			})
		);
		void request
			.then((draft) => {
				if (cancelled || !draft) return;
				rating = draft.rating;
				review = draft.text;
				containsSpoilers = draft.containsSpoilers;
			})
			.catch((cause) => {
				if (cancelled) return;
				reviewError = cause instanceof Error ? cause.message : 'Could not load your review.';
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	function markChanged() {
		saved = false;
		reviewError = '';
	}

	function handleRatingShortcut(event: KeyboardEvent) {
		if (!reviewDialog.open || loading || saving || event.metaKey || event.ctrlKey || event.altKey) {
			return;
		}
		if (!/^[1-9]$/.test(event.key)) return;

		const target = event.target;
		if (
			target instanceof HTMLTextAreaElement ||
			(target instanceof HTMLInputElement && !['radio', 'checkbox'].includes(target.type)) ||
			(target instanceof HTMLElement && target.isContentEditable)
		) {
			return;
		}

		event.preventDefault();
		rating = Number(event.key);
		markChanged();
	}

	async function saveReview() {
		const item = reviewDialog.item;
		if (!item || rating === 0 || loading || saving) return;

		saving = true;
		saved = false;
		reviewError = '';

		try {
			const imageUrl = posterUrl(item.poster, 'w500');
			await saveReviewRecord({
				media: {
					creativeWorkType: item.creativeWorkType,
					tmdbId: item.tmdbId,
					title: item.title,
					...(imageUrl ? { posterUrl: imageUrl } : {})
				},
				rating,
				text: review,
				containsSpoilers
			});
			saved = true;
			void invalidateAll();
			window.setTimeout(() => reviewDialog.hide(), 500);
		} catch (cause) {
			reviewError = cause instanceof Error ? cause.message : 'Could not save review.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onkeydown={handleRatingShortcut} />

<Dialog.Root bind:open={reviewDialog.open} onOpenChange={(open) => !open && reviewDialog.hide()}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-100 bg-black/75 backdrop-blur-md" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-101 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-base-950 p-5 text-white shadow-2xl outline-none"
		>
			<Dialog.Title class="text-sm font-semibold">rate & review</Dialog.Title>
			<Dialog.Description class="sr-only">
				Choose a star rating and optionally write a review.
			</Dialog.Description>

			<Dialog.Close
				class="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-full text-base-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
			>
				<X class="size-4" strokeWidth={1.5} aria-hidden="true" />
				<span class="sr-only">Close review</span>
			</Dialog.Close>

			{#if reviewDialog.item}
				<div class:opacity-60={loading} class="mt-5">
					<div class="flex items-center gap-4">
						<div class="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-base-900">
							{#if reviewDialog.item.poster}
								<img
									src={posterUrl(reviewDialog.item.poster, 'w185')}
									alt="Poster for {reviewDialog.item.title}"
									class="size-full object-cover"
								/>
							{/if}
						</div>
						<div class="min-w-0">
							<div class="truncate font-semibold">{reviewDialog.item.title}</div>
							<div
								class:pointer-events-none={loading || saving}
								class="mt-2"
								aria-disabled={loading || saving}
							>
								<RatingInput bind:value={rating} onchange={markChanged} />
							</div>
						</div>
					</div>

					<label for="review-text" class="sr-only">Review</label>
					<textarea
						id="review-text"
						bind:value={review}
						oninput={markChanged}
						disabled={loading || saving}
						rows="4"
						maxlength="1000"
						placeholder="write a review (optional)"
						class="mt-4 block w-full resize-none rounded-lg border border-white/10 bg-base-900 px-3 py-2 text-sm text-white outline-none placeholder:text-base-500 focus:border-white/25 focus:ring-0 disabled:cursor-wait"
					></textarea>

					<label class="mt-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-base-300">
						<input
							type="checkbox"
							bind:checked={containsSpoilers}
							onchange={markChanged}
							disabled={loading || saving}
							class="size-4 rounded border-base-700 bg-base-900 text-accent-500 focus:ring-2 focus:ring-accent-500/40 focus:ring-offset-0"
						/>
						contains spoilers
					</label>
				</div>

				{#if reviewError}
					<p class="mt-3 text-sm text-red-300" role="alert">{reviewError}</p>
				{/if}

				<button
					type="button"
					onclick={saveReview}
					disabled={rating === 0 || loading || saving || saved}
					class="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg border border-accent-900 bg-accent-950/80 text-sm font-semibold text-accent-300 transition-colors hover:bg-accent-950 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{loading ? 'loading…' : saving ? 'saving…' : saved ? 'saved' : 'save review'}
				</button>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
