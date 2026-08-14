<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { posterUrl } from '../_lib/images';
	import { reviewDialog, reviewLibrary } from '../_lib/review.svelte';
	import RatingInput from './RatingInput.svelte';

	type SavedReview = {
		rating: number;
		ratingScale?: 10;
		review: string;
		watched?: boolean;
	};

	let rating = $state(0);
	let review = $state('');
	let watched = $state(true);
	let saved = $state(false);
	let storageKey = $derived(reviewDialog.item ? `atmo-review:${reviewDialog.item.ref}` : '');

	$effect(() => {
		const key = storageKey;
		if (!reviewDialog.open || !key) return;

		let stored: SavedReview | undefined;
		try {
			stored = JSON.parse(localStorage.getItem(key) ?? 'null') as SavedReview | undefined;
		} catch {
			stored = undefined;
		}

		rating = stored?.rating ? (stored.ratingScale === 10 ? stored.rating : stored.rating * 2) : 0;
		review = stored?.review ?? '';
		watched = stored?.watched ?? true;
		saved = false;
	});

	function handleRatingShortcut(event: KeyboardEvent) {
		if (!reviewDialog.open || event.metaKey || event.ctrlKey || event.altKey) return;
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
		saved = false;
	}

	function saveReview() {
		if (!storageKey || rating === 0) return;

		localStorage.setItem(
			storageKey,
			JSON.stringify({ rating, ratingScale: 10, review: review.trim(), watched })
		);
		if (reviewDialog.item) reviewLibrary.setWatched(reviewDialog.item.ref, watched);
		saved = true;
		window.setTimeout(() => reviewDialog.hide(), 350);
	}
</script>

<svelte:window onkeydown={handleRatingShortcut} />

<Dialog.Root bind:open={reviewDialog.open} onOpenChange={(open) => !open && reviewDialog.hide()}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-100 bg-black/75 backdrop-blur-md" />
		<Dialog.Content
			class="bg-base-950 fixed top-1/2 left-1/2 z-101 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 p-5 text-white shadow-2xl outline-none"
		>
			<Dialog.Title class="text-sm font-semibold">rate & review</Dialog.Title>
			<Dialog.Description class="sr-only">
				Choose a star rating and optionally write a review.
			</Dialog.Description>

			<Dialog.Close
				class="text-base-400 absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-full transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
			>
				<svg
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
				</svg>
				<span class="sr-only">Close review</span>
			</Dialog.Close>

			{#if reviewDialog.item}
				<div class="mt-5 flex items-center gap-4">
					<div class="bg-base-900 h-24 w-16 shrink-0 overflow-hidden rounded-md">
						{#if reviewDialog.item.poster_path}
							<img
								src={posterUrl(reviewDialog.item.poster_path, 'w185')}
								alt="Poster for {reviewDialog.item.title}"
								class="size-full object-cover"
							/>
						{/if}
					</div>
					<div class="min-w-0">
						<div class="truncate font-semibold">{reviewDialog.item.title}</div>
						<div class="mt-2">
							<RatingInput bind:value={rating} onchange={() => (saved = false)} />
						</div>
					</div>
				</div>

				<label class="text-base-300 mt-4 flex w-fit cursor-pointer items-center gap-2 text-xs">
					<input
						type="checkbox"
						bind:checked={watched}
						onchange={() => (saved = false)}
						class="border-base-700 bg-base-900 text-accent-500 focus:ring-accent-500/40 size-4 rounded focus:ring-2 focus:ring-offset-0"
					/>
					mark as watched
				</label>

				<label for="review-text" class="sr-only">Review</label>
				<textarea
					id="review-text"
					bind:value={review}
					oninput={() => (saved = false)}
					rows="4"
					maxlength="1000"
					placeholder="write a review (optional)"
					class="bg-base-900 placeholder:text-base-500 mt-4 block w-full resize-none rounded-lg border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-white/25 focus:ring-0"
				></textarea>

				<button
					type="button"
					onclick={saveReview}
					disabled={rating === 0}
					class="bg-accent-950/80 text-accent-300 border-accent-900 hover:bg-accent-950 mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				>
					{saved ? 'saved' : 'save review'}
				</button>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
