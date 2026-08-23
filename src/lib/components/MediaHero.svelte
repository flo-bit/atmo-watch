<script lang="ts">
	import type { MediaImage, MediaLogo } from '$lib/types';
	import { backdropUrl, logoUrl, posterUrl, stillUrl } from '$lib/images';

	let {
		title,
		backdrop = null,
		backdropVariant = 'backdrop',
		fallbackPoster = null,
		logo = null,
		href,
		titleIsHeading = true
	}: {
		title: string;
		backdrop?: MediaImage | null;
		backdropVariant?: 'backdrop' | 'still';
		fallbackPoster?: MediaImage | null;
		logo?: MediaLogo | null;
		href?: string;
		titleIsHeading?: boolean;
	} = $props();

	let imageUrl = $derived(
		backdrop
			? backdropVariant === 'still'
				? stillUrl(backdrop, 'original')
				: backdropUrl(backdrop, 'w1280')
			: posterUrl(fallbackPoster, 'w780')
	);
	let originalImageUrl = $derived(
		backdrop
			? backdropVariant === 'still'
				? stillUrl(backdrop, 'original')
				: backdropUrl(backdrop, 'original')
			: posterUrl(fallbackPoster, 'original')
	);
	let titleLogoUrl = $derived(logoUrl(logo?.path, 'w500'));
	let titleLogoOriginalUrl = $derived(logoUrl(logo?.path, 'original'));
</script>

{#snippet titleContent()}
	{#if titleIsHeading}
		<h1
			class={titleLogoUrl
				? 'sr-only'
				: 'media-page-wordmark text-[2.5rem] leading-[1.05] font-bold tracking-tight text-white drop-shadow-xl sm:text-5xl'}
		>
			{title}
		</h1>
	{:else}
		<span
			class={titleLogoUrl
				? 'sr-only'
				: 'media-page-wordmark block text-[2.5rem] leading-[1.05] font-bold tracking-tight text-white drop-shadow-xl sm:text-5xl'}
		>
			{title}
		</span>
	{/if}

	{#if titleLogoUrl && titleLogoOriginalUrl}
		<picture class="contents">
			<source srcset={`${titleLogoUrl} 1x, ${titleLogoOriginalUrl} 2x`} />
			<img
				src={titleLogoUrl}
				alt=""
				width={logo?.width}
				height={logo?.height}
				fetchpriority="high"
				class="media-page-wordmark mx-auto max-h-36 w-full max-w-[20rem] object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] sm:max-w-sm"
			/>
		</picture>
	{/if}
{/snippet}

<div
	class={`relative isolate mx-auto w-full max-w-[96rem] ${imageUrl ? 'pt-[35svh] lg:pt-[50svh]' : 'pt-14'}`}
>
	{#if imageUrl}
		{#key imageUrl}
			{#if href}
				<a
					{href}
					aria-label={`View ${title}`}
					class="absolute inset-0 z-0 block focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-400"
				>
					<picture class="contents">
						{#if originalImageUrl}
							<source media="(min-width: 1024px)" srcset={originalImageUrl} />
						{/if}
						<img
							src={imageUrl}
							alt=""
							class="media-page-backdrop size-full object-cover object-center"
							style="-webkit-mask-image: linear-gradient(to bottom, black 0%, black 40%, transparent 100%); mask-image: linear-gradient(to bottom, black 0%, black 40%, transparent 100%);"
						/>
					</picture>
				</a>
			{:else}
				<picture class="contents">
					{#if originalImageUrl}
						<source media="(min-width: 1024px)" srcset={originalImageUrl} />
					{/if}
					<img
						src={imageUrl}
						alt=""
						class="media-page-backdrop pointer-events-none absolute inset-0 z-0 size-full object-cover object-center"
						style="-webkit-mask-image: linear-gradient(to bottom, black 0%, black 40%, transparent 100%); mask-image: linear-gradient(to bottom, black 0%, black 40%, transparent 100%);"
					/>
				</picture>
			{/if}
		{/key}
	{/if}

	{#if href}
		<a
			{href}
			class="relative z-10 mx-auto block max-w-3xl px-4 text-center transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400 sm:px-8"
		>
			{@render titleContent()}
		</a>
	{:else}
		<div class="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-8">
			{@render titleContent()}
		</div>
	{/if}
</div>
