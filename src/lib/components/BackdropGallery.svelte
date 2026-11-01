<script lang="ts">
	import { PhotoLightbox } from '@atmo-dev/kit';
	import HorizontalScroller from './HorizontalScroller.svelte';
	import { backdropUrl } from '$lib/images';
	import type { MediaImage } from '$lib/types';

	let { images, title }: { images: readonly MediaImage[]; title: string } = $props();
	let open = $state(false);
	let selectedIndex = $state(0);
	let returnFocus = $state<HTMLElement | null>(null);
	let photos = $derived(
		images.map((image, index) => ({
			src: backdropUrl(image, 'original')!,
			alt: `Backdrop ${index + 1} for ${title}`
		}))
	);
</script>

<HorizontalScroller
	class="mt-4 gap-3 pb-3 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0"
	label={`Backdrops for ${title}`}
>
	{#each images as image, index (image.source === 'tmdb' ? image.path : image.url)}
		<button
			type="button"
			onclick={(event) => {
				selectedIndex = index;
				returnFocus = event.currentTarget;
				open = true;
			}}
			class="group w-[82vw] max-w-sm shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-base-900 text-left transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 lg:w-auto lg:max-w-none"
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
</HorizontalScroller>

<PhotoLightbox
	{photos}
	bind:open
	bind:index={selectedIndex}
	{returnFocus}
	label={`Backdrops for ${title}`}
/>
