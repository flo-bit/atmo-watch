<script lang="ts">
	import { Check, ChevronDown, RotateCcw } from '@lucide/svelte';
	import DefaultOpenGraphImage from '$lib/components/DefaultOpenGraphImage.svelte';
	import MediaHero from '$lib/components/MediaHero.svelte';
	import { backdropUrl, logoUrl } from '$lib/images';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// These are local form selections initialized from the latest server response.
	// svelte-ignore state_referenced_locally
	let selectedBackdropPath = $state(
		form && 'backdropPath' in form ? (form.backdropPath ?? '') : (data.backdropOverridePath ?? '')
	);
	// svelte-ignore state_referenced_locally
	let selectedLogoPath = $state(
		form && 'logoPath' in form ? (form.logoPath ?? '') : (data.logoOverridePath ?? '')
	);
	let showAllBackdrops = $state(false);
	let showAllLogos = $state(false);
	let activeBackdropPath = $derived(selectedBackdropPath || data.defaultBackdropPath);
	let activeBackdrop = $derived(
		data.backdrops.find((image) => image.source === 'tmdb' && image.path === activeBackdropPath) ??
			null
	);
	let activeLogoPath = $derived(selectedLogoPath || data.defaultLogoPath);
	let activeLogo = $derived(data.logos.find((logo) => logo.path === activeLogoPath) ?? null);

	function backdropPath(image: PageData['backdrops'][number]) {
		return image.source === 'tmdb' ? image.path : image.url;
	}

	function backdropFormValue(image: PageData['backdrops'][number]) {
		const path = backdropPath(image);
		return path === data.defaultBackdropPath ? '' : path;
	}

	function logoFormValue(logo: PageData['logos'][number]) {
		return logo.path === data.defaultLogoPath ? '' : logo.path;
	}

	function restoreDefaults() {
		selectedBackdropPath = '';
		selectedLogoPath = '';
	}
</script>

<svelte:head>
	<title>Edit artwork for {data.item.title} | atmo.watch</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<DefaultOpenGraphImage />

<main class="min-h-dvh bg-base-950 pb-20 text-base-50">
	<section class="relative isolate overflow-hidden">
		<MediaHero title={data.item.title} backdrop={activeBackdrop} logo={activeLogo} />
	</section>

	<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
		<form method="POST" class="mt-10 space-y-12">
			<fieldset>
				<div class="flex items-end justify-between gap-4">
					<div>
						<legend class="text-xl font-semibold tracking-tight">Backdrop</legend>
						<p class="mt-1 text-sm text-base-400">{data.backdrops.length} available</p>
					</div>
				</div>

				{#if data.backdrops.length > 0}
					<div class="artwork-options" data-expanded={showAllBackdrops}>
						<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{#if data.defaultBackdropPath === null}
								<label
									class={`artwork-option artwork-empty-option relative aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-base-900 p-4 text-center transition ${selectedBackdropPath === '' ? 'border-accent-400 ring-2 ring-accent-400/30' : 'border-white/10 hover:border-white/30'}`}
								>
									<input
										class="sr-only"
										type="radio"
										name="backdropPath"
										value=""
										bind:group={selectedBackdropPath}
									/>
									<span class="text-sm font-semibold text-base-300">TMDB default: no backdrop</span>
								</label>
							{/if}
							{#each data.backdrops as image, index (backdropPath(image))}
								{@const value = backdropFormValue(image)}
								<label
									class={`artwork-option group relative cursor-pointer overflow-hidden rounded-xl border bg-base-900 transition ${selectedBackdropPath === value ? 'border-accent-400 ring-2 ring-accent-400/30' : 'border-white/10 hover:border-white/30'}`}
								>
									<input
										class="sr-only"
										type="radio"
										name="backdropPath"
										{value}
										bind:group={selectedBackdropPath}
									/>
									<img
										src={backdropUrl(image, 'w780')}
										alt={`Backdrop option ${index + 1}`}
										loading="lazy"
										class="aspect-video size-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
									/>
									{#if value === ''}
										<span
											class="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[0.625rem] font-semibold tracking-wide text-white uppercase backdrop-blur-sm"
										>
											TMDB default
										</span>
									{/if}
									{#if selectedBackdropPath === value}
										<span
											class="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-accent-500 text-white shadow-lg"
										>
											<Check class="size-4" strokeWidth={2.2} aria-hidden="true" />
										</span>
									{/if}
								</label>
							{/each}
						</div>
						<button
							type="button"
							onclick={() => (showAllBackdrops = !showAllBackdrops)}
							aria-expanded={showAllBackdrops}
							class="artwork-toggle mt-4 h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-4 text-xs font-semibold text-base-200 transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
						>
							{showAllBackdrops ? 'Show less' : 'Show more'}
							<ChevronDown
								class={`size-3.5 transition-transform ${showAllBackdrops ? 'rotate-180' : ''}`}
								strokeWidth={1.8}
								aria-hidden="true"
							/>
						</button>
					</div>
				{:else}
					<input type="hidden" name="backdropPath" value="" />
					<p
						class="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-base-400"
					>
						TMDB has no backdrops for this title.
					</p>
				{/if}
			</fieldset>

			<fieldset>
				<legend class="text-xl font-semibold tracking-tight">Wordmark</legend>
				<p class="mt-1 text-sm text-base-400">{data.logos.length} available</p>

				{#if data.logos.length > 0}
					<div class="artwork-options" data-expanded={showAllLogos}>
						<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{#if data.defaultLogoPath === null}
								<label
									class={`artwork-option artwork-empty-option relative aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-base-900 p-4 text-center transition ${selectedLogoPath === '' ? 'border-accent-400 ring-2 ring-accent-400/30' : 'border-white/10 hover:border-white/30'}`}
								>
									<input
										class="sr-only"
										type="radio"
										name="logoPath"
										value=""
										bind:group={selectedLogoPath}
									/>
									<span class="text-lg font-bold tracking-tight text-white">{data.item.title}</span>
								</label>
							{/if}
							{#each data.logos as logo, index (logo.path)}
								{@const value = logoFormValue(logo)}
								<label
									class={`artwork-option relative cursor-pointer overflow-hidden rounded-xl border bg-base-900 transition ${selectedLogoPath === value ? 'border-accent-400 ring-2 ring-accent-400/30' : 'border-white/10 hover:border-white/30'}`}
								>
									<input
										class="sr-only"
										type="radio"
										name="logoPath"
										{value}
										bind:group={selectedLogoPath}
									/>
									<div class="grid aspect-video grid-cols-2">
										<div class="flex items-center justify-center bg-black p-4">
											<img
												src={logoUrl(logo.path, 'w300')}
												alt={`Wordmark option ${index + 1} on black`}
												loading="lazy"
												class="max-h-full max-w-full object-contain"
											/>
										</div>
										<div class="flex items-center justify-center bg-white p-4">
											<img
												src={logoUrl(logo.path, 'w300')}
												alt=""
												loading="lazy"
												class="max-h-full max-w-full object-contain"
											/>
										</div>
									</div>
									{#if value === ''}
										<span
											class="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[0.625rem] font-semibold tracking-wide text-white uppercase backdrop-blur-sm"
										>
											TMDB default
										</span>
									{/if}
									{#if selectedLogoPath === value}
										<span
											class="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-accent-500 text-white shadow-lg"
										>
											<Check class="size-4" strokeWidth={2.2} aria-hidden="true" />
										</span>
									{/if}
								</label>
							{/each}
						</div>
						<button
							type="button"
							onclick={() => (showAllLogos = !showAllLogos)}
							aria-expanded={showAllLogos}
							class="artwork-toggle mt-4 h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-4 text-xs font-semibold text-base-200 transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
						>
							{showAllLogos ? 'Show less' : 'Show more'}
							<ChevronDown
								class={`size-3.5 transition-transform ${showAllLogos ? 'rotate-180' : ''}`}
								strokeWidth={1.8}
								aria-hidden="true"
							/>
						</button>
					</div>
				{:else}
					<input type="hidden" name="logoPath" value="" />
					<p
						class="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-base-400"
					>
						TMDB has no English or language-neutral wordmarks for this title. The title will be
						shown as text.
					</p>
				{/if}
			</fieldset>

			<div
				class="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between"
			>
				<div class="min-h-5">
					{#if form?.message}
						<p
							class={`text-sm ${form.success ? 'text-emerald-300' : 'text-red-300'}`}
							role="status"
						>
							{form.message}
						</p>
					{:else if data.updatedAt}
						<p class="text-xs text-base-500">
							Last changed {new Date(data.updatedAt).toLocaleString()}
						</p>
					{/if}
				</div>
				<div class="flex flex-col-reverse gap-2 sm:flex-row">
					<button
						type="button"
						onclick={restoreDefaults}
						class="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 text-sm font-semibold text-base-200 transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
					>
						<RotateCcw class="size-4" strokeWidth={1.8} aria-hidden="true" />
						Use TMDB defaults
					</button>
					<button
						type="submit"
						class="inline-flex h-10 items-center justify-center rounded-full bg-base-50 px-6 text-sm font-bold text-base-950 transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
					>
						Save artwork
					</button>
				</div>
			</div>
		</form>
	</div>
</main>

<style>
	.artwork-option {
		display: block;
	}

	.artwork-empty-option {
		display: flex;
	}

	.artwork-options:not([data-expanded='true']) .artwork-option:nth-child(n + 3) {
		display: none;
	}

	.artwork-toggle {
		display: none;
	}

	.artwork-options:has(.artwork-option:nth-child(3)) .artwork-toggle {
		display: inline-flex;
	}

	@media (min-width: 640px) {
		.artwork-options:not([data-expanded='true']) .artwork-option:nth-child(n + 3) {
			display: block;
		}

		.artwork-options:not([data-expanded='true']) .artwork-empty-option:nth-child(n + 3) {
			display: flex;
		}

		.artwork-options:not([data-expanded='true']) .artwork-option:nth-child(n + 5) {
			display: none;
		}

		.artwork-options:has(.artwork-option:nth-child(3)) .artwork-toggle {
			display: none;
		}

		.artwork-options:has(.artwork-option:nth-child(5)) .artwork-toggle {
			display: inline-flex;
		}
	}

	@media (min-width: 1024px) {
		.artwork-options:not([data-expanded='true']) .artwork-option:nth-child(n + 3) {
			display: block;
		}

		.artwork-options:not([data-expanded='true']) .artwork-empty-option:nth-child(n + 3) {
			display: flex;
		}

		.artwork-options:not([data-expanded='true']) .artwork-option:nth-child(n + 7) {
			display: none;
		}

		.artwork-options:has(.artwork-option:nth-child(5)) .artwork-toggle {
			display: none;
		}

		.artwork-options:has(.artwork-option:nth-child(7)) .artwork-toggle {
			display: inline-flex;
		}
	}
</style>
