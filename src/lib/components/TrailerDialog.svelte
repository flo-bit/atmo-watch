<script lang="ts">
	import { Dialog } from 'bits-ui';

	let { url, title }: { url: string; title: string } = $props();
	let open = $state(false);
	let videoId = $derived(getYouTubeId(url));
	let embedUrl = $derived(
		videoId
			? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1&rel=0`
			: null
	);

	function getYouTubeId(value: string) {
		try {
			const parsed = new URL(value);

			if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1) || null;
			if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || null;
			return parsed.searchParams.get('v');
		} catch {
			return null;
		}
	}
</script>

{#if embedUrl}
	<Dialog.Root bind:open>
		<Dialog.Trigger
			class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
		>
			<svg
				class="size-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="m15.75 10.5 4.72-2.36a.75.75 0 0 1 1.08.67v6.38a.75.75 0 0 1-1.08.67l-4.72-2.36m-9.75 4h7.5a2.25 2.25 0 0 0 2.25-2.25v-6.5A2.25 2.25 0 0 0 13.5 6.5H6a2.25 2.25 0 0 0-2.25 2.25v6.5A2.25 2.25 0 0 0 6 17.5Z"
				/>
			</svg>
			trailer
		</Dialog.Trigger>

		<Dialog.Portal>
			<Dialog.Overlay class="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md" />
			<Dialog.Content
				class="fixed top-1/2 left-1/2 z-[101] aspect-video w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-visible rounded-xl outline-none"
			>
				<Dialog.Title class="sr-only">{title} trailer</Dialog.Title>
				<Dialog.Description class="sr-only">
					YouTube trailer for {title}. Press Escape or click outside the player to close.
				</Dialog.Description>

				<div
					class="size-full overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl"
				>
					<iframe
						src={embedUrl}
						title={`${title} trailer`}
						class="size-full border-0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
						referrerpolicy="strict-origin-when-cross-origin"
						allowfullscreen
					></iframe>
				</div>

				<Dialog.Close
					class="absolute -top-12 right-0 z-10 inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
				>
					<svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
							clip-rule="evenodd"
						/>
					</svg>
					<span class="sr-only">Close trailer</span>
				</Dialog.Close>
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{/if}
