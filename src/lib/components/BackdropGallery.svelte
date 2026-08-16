<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { backdropUrl } from '$lib/images';
	import type { MediaImage } from '$lib/types';

	let {
		images,
		title
	}: {
		images: readonly MediaImage[];
		title: string;
	} = $props();

	let open = $state(false);
	let selectedIndex = $state(0);
	let selectedImage = $derived(images[selectedIndex]);

	function openImage(index: number) {
		selectedIndex = index;
		open = true;
	}

	function moveSelection(offset: number) {
		if (images.length < 2) return;
		selectedIndex = (selectedIndex + offset + images.length) % images.length;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;

		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			moveSelection(-1);
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			moveSelection(1);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="mt-4 grid gap-3 sm:grid-cols-2">
	{#each images as image, index (image.source === 'tmdb' ? image.path : image.url)}
		<button
			type="button"
			onclick={() => openImage(index)}
			class="group overflow-hidden rounded-xl border border-white/10 bg-base-900 text-left transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
			aria-label={`Open backdrop ${index + 1} of ${images.length} for ${title}`}
		>
			<img
				src={backdropUrl(image, 'w780')}
				alt=""
				loading="lazy"
				class="aspect-video size-full object-cover transition-transform duration-300 group-hover:scale-[1.015] motion-reduce:transition-none"
			/>
		</button>
	{/each}
</div>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-[101] w-[calc(100%-2rem)] max-w-7xl -translate-x-1/2 -translate-y-1/2 outline-none sm:w-[calc(100%-6rem)]"
		>
			<Dialog.Title class="sr-only">Backdrops for {title}</Dialog.Title>
			<Dialog.Description class="sr-only">
				Backdrop {selectedIndex + 1} of {images.length}. Use the left and right arrow keys to
				browse, or press Escape to close.
			</Dialog.Description>

			{#if selectedImage}
				<img
					src={backdropUrl(selectedImage, 'original')}
					alt="Backdrop {selectedIndex + 1} for {title}"
					class="mx-auto max-h-[calc(100dvh-6rem)] max-w-full rounded-xl border border-white/15 bg-black object-contain shadow-2xl"
				/>
			{/if}

			{#if images.length > 1}
				<button
					type="button"
					onclick={() => moveSelection(-1)}
					class="absolute top-1/2 left-2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-4"
					aria-label="Previous backdrop"
				>
					<svg
						class="size-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.8"
							d="m15 18-6-6 6-6"
						/>
					</svg>
				</button>

				<button
					type="button"
					onclick={() => moveSelection(1)}
					class="absolute top-1/2 right-2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-4"
					aria-label="Next backdrop"
				>
					<svg
						class="size-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.8"
							d="m9 18 6-6-6-6"
						/>
					</svg>
				</button>

				<div
					class="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white tabular-nums backdrop-blur-sm"
				>
					{selectedIndex + 1} / {images.length}
				</div>
			{/if}

			<Dialog.Close
				class="absolute -top-12 right-0 inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
			>
				<svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
						clip-rule="evenodd"
					/>
				</svg>
				<span class="sr-only">Close backdrops</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
