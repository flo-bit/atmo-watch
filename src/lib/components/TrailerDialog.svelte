<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { Film } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	let {
		url,
		title,
		variant = 'button',
		fill = false,
		iconOnly = false,
		class: className
	}: {
		url: string;
		title: string;
		variant?: 'button' | 'feature' | 'action';
		fill?: boolean;
		iconOnly?: boolean;
		class?: string;
	} = $props();
	let open = $state(false);
	let useFallbackThumbnail = $state(false);
	let videoId = $derived(getYouTubeId(url));
	let embedUrl = $derived(
		videoId
			? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1&rel=0`
			: null
	);
	let thumbnailUrl = $derived(
		videoId
			? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${useFallbackThumbnail ? 'hqdefault' : 'maxresdefault'}.jpg`
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

{#snippet playIcon(className: string)}
	<svg class={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path
			d="M8.75 6.1a1 1 0 0 1 1.52-.85l8.1 5.22a1 1 0 0 1 0 1.68l-8.1 5.22a1 1 0 0 1-1.52-.84V6.1Z"
		/>
	</svg>
{/snippet}

{#if embedUrl}
	<Dialog.Root bind:open>
		{#if variant === 'feature'}
			<Dialog.Trigger
				class={cn(
					'group block size-full overflow-hidden rounded-xl border border-white/10 bg-base-900 text-left shadow-2xl shadow-black/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
					fill ? 'absolute inset-0' : 'relative',
					className
				)}
				aria-label={`Play the trailer for ${title}`}
			>
				{#if thumbnailUrl}
					<img
						src={thumbnailUrl}
						alt=""
						class="size-full object-cover transition duration-500 group-hover:scale-[1.025] group-hover:opacity-90 motion-reduce:transition-none"
						onerror={() => (useFallbackThumbnail = true)}
					/>
				{/if}
				<span
					class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/10"
					aria-hidden="true"
				></span>
				<span
					class="absolute top-1/2 left-1/2 inline-flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-black shadow-xl transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none sm:size-16"
					aria-hidden="true"
				>
					{@render playIcon('ml-0.5 size-6 sm:size-8')}
				</span>
				<span class="absolute right-3 bottom-2.5 left-3 flex items-center gap-2 text-white">
					<span class="text-xs font-semibold tracking-wide sm:text-sm">Watch trailer</span>
				</span>
			</Dialog.Trigger>
		{:else if variant === 'action'}
			<Dialog.Trigger
				class={cn(
					'group flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-2 text-center text-white transition-colors hover:text-accent-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 lg:gap-0 lg:p-0',
					className
				)}
				aria-label={`Play the trailer for ${title}`}
				title={iconOnly ? 'Play trailer' : undefined}
			>
				<span
					class="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-lg shadow-black/10 backdrop-blur-sm transition-colors group-hover:bg-white/15 lg:size-9"
				>
					<Film class="size-4" strokeWidth={1.8} aria-hidden="true" />
				</span>
				<span
					class={iconOnly ? 'sr-only' : 'text-xs leading-4 font-medium text-base-200 lg:sr-only'}
				>
					watch trailer
				</span>
			</Dialog.Trigger>
		{:else}
			<Dialog.Trigger
				class={cn(
					'inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
					className
				)}
			>
				{@render playIcon('size-4')}
				trailer
			</Dialog.Trigger>
		{/if}

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
