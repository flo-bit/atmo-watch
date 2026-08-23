<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Command } from 'bits-ui';
	import { posterUrl } from '$lib/images';
	import { loginDialog } from '$lib/login.svelte';
	import { reviewDialog } from '$lib/review.svelte';
	import type { MediaSummary } from '$lib/types';
	import { cn, mediaKey, slugify, toMediaRouteKind } from '$lib/utils';

	let {
		did,
		autofocus = true,
		class: className,
		onReview = (item: MediaSummary) => reviewDialog.show(item),
		onLoginRequired = () => loginDialog.show()
	}: {
		did: string | null;
		autofocus?: boolean;
		class?: string;
		onReview?: (item: MediaSummary) => void;
		onLoginRequired?: () => void;
	} = $props();

	let query = $state('');
	let results = $state<MediaSummary[]>([]);
	let searching = $state(false);
	let hasSearched = $state(false);
	let searchError = $state('');
	let resultsOpen = $state(false);
	let rootElement = $state<HTMLElement | null>(null);
	let resultsPlacement = $state<'above' | 'below'>('below');
	let resultsMaxHeight = $state(384);

	function reviewItem(item: MediaSummary) {
		resultsOpen = false;
		if (!did) {
			onLoginRequired();
			return;
		}

		onReview(item);
	}

	function itemUrl(item: MediaSummary) {
		return resolve('/[kind]/[id]', {
			kind: toMediaRouteKind(item.creativeWorkType),
			id: `${item.tmdbId}-${slugify(item.title)}`
		});
	}

	function handleFocusOut(event: FocusEvent) {
		const root = event.currentTarget as HTMLElement;
		const next = event.relatedTarget;

		if (!(next instanceof Node) || !root.contains(next)) {
			resultsOpen = false;
		}
	}

	function updateResultsPlacement() {
		if (!rootElement) return;

		const rect = rootElement.getBoundingClientRect();
		const viewport = window.visualViewport;
		const viewportTop = viewport?.offsetTop ?? 0;
		const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
		const gap = 8;
		const spaceAbove = Math.max(0, rect.top - viewportTop - gap);
		const spaceBelow = Math.max(0, viewportBottom - rect.bottom - gap);

		resultsPlacement = spaceAbove > spaceBelow && spaceBelow < 384 ? 'above' : 'below';
		const availableSpace = resultsPlacement === 'above' ? spaceAbove : spaceBelow;
		resultsMaxHeight = Math.max(64, Math.min(384, Math.floor(availableSpace)));
	}

	async function search(term: string, controller: AbortController) {
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
				signal: controller.signal
			});

			if (!response.ok) {
				throw new Error('Search is unavailable right now');
			}

			const items = (await response.json()) as MediaSummary[];
			if (controller.signal.aborted || term !== query.trim()) return;

			results = items;
			hasSearched = true;
		} catch (cause) {
			if (controller.signal.aborted) return;

			searchError = cause instanceof Error ? cause.message : 'Search is unavailable right now';
			hasSearched = true;
		} finally {
			if (!controller.signal.aborted && term === query.trim()) searching = false;
		}
	}

	$effect(() => {
		if (!resultsOpen || query.trim().length < 2 || !rootElement) return;

		const frame = window.requestAnimationFrame(updateResultsPlacement);
		const viewport = window.visualViewport;
		window.addEventListener('resize', updateResultsPlacement);
		window.addEventListener('scroll', updateResultsPlacement, true);
		viewport?.addEventListener('resize', updateResultsPlacement);
		viewport?.addEventListener('scroll', updateResultsPlacement);

		return () => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener('resize', updateResultsPlacement);
			window.removeEventListener('scroll', updateResultsPlacement, true);
			viewport?.removeEventListener('resize', updateResultsPlacement);
			viewport?.removeEventListener('scroll', updateResultsPlacement);
		};
	});

	$effect(() => {
		const term = query.trim();

		results = [];
		hasSearched = false;
		searchError = '';

		if (term.length < 2) {
			searching = false;
			return;
		}

		searching = true;
		const controller = new AbortController();
		const timeout = window.setTimeout(() => search(term, controller), 250);

		return () => {
			window.clearTimeout(timeout);
			controller.abort();
		};
	});
</script>

<Command.Root
	bind:ref={rootElement}
	shouldFilter={false}
	onfocusin={() => (resultsOpen = true)}
	onfocusout={handleFocusOut}
	loop={true}
	label="Search movies and TV shows"
	class={cn(
		'relative z-50 rounded-2xl border border-white/10 bg-black/40 shadow-2xl shadow-black/40 backdrop-blur-xl transition-colors focus-within:border-accent-500/50',
		className
	)}
>
	<div class="flex h-16 items-center gap-3 px-4">
		<svg
			class="size-5 shrink-0 text-base-400"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="7"></circle>
			<path d="m20 20-3.5-3.5"></path>
		</svg>

		<Command.Input
			bind:value={query}
			{autofocus}
			autocomplete="off"
			spellcheck="false"
			placeholder="Search movies and TV shows…"
			class="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-lg font-medium text-white shadow-none ring-0 outline-none placeholder:text-base-500 focus:border-0 focus:ring-0 focus:outline-none"
		/>

		{#if searching}
			<svg
				class="size-5 animate-spin text-accent-400"
				viewBox="0 0 24 24"
				fill="none"
				aria-label="Searching"
			>
				<circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"
				></circle>
				<path class="opacity-90" fill="currentColor" d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Z"
				></path>
			</svg>
		{/if}
	</div>

	{#if resultsOpen && query.trim().length >= 2}
		<Command.List
			class={cn(
				'absolute right-0 left-0 z-50 overflow-y-auto rounded-2xl border border-white/10 bg-base-950/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl',
				resultsPlacement === 'above' ? 'bottom-[calc(100%+0.5rem)]' : 'top-[calc(100%+0.5rem)]'
			)}
			style={`max-height: ${resultsMaxHeight}px`}
		>
			<Command.Viewport>
				{#if searching}
					<Command.Loading
						progress={0}
						class="flex items-center justify-center px-4 py-8 text-sm text-base-400"
					>
						Searching…
					</Command.Loading>
				{:else if searchError}
					<div class="px-4 py-8 text-center text-sm text-red-400" role="alert">
						{searchError}
					</div>
				{:else if hasSearched && results.length === 0}
					<Command.Empty forceMount class="px-4 py-8 text-center text-sm text-base-400">
						No movies or TV shows found.
					</Command.Empty>
				{:else if results.length > 0}
					<Command.Group value="Search results">
						<Command.GroupHeading class="sr-only">Search results</Command.GroupHeading>
						<Command.GroupItems class="flex flex-col gap-1">
							{#each results as item (mediaKey(item))}
								<Command.Item
									onSelect={() => void goto(itemUrl(item))}
									value={`${item.title} ${item.creativeWorkType} ${item.tmdbId}`}
									keywords={[item.title, item.creativeWorkType]}
									class="flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-colors outline-none data-selected:bg-white/10"
								>
									<div
										class="h-18 w-12 shrink-0 overflow-hidden rounded-md border border-white/10 bg-base-900"
									>
										{#if item.poster}
											<img
												src={posterUrl(item.poster, 'w185')}
												alt="Poster for {item.title}"
												class="size-full object-cover"
											/>
										{/if}
									</div>

									<div class="min-w-0 flex-1 truncate text-base font-semibold text-white">
										{item.title}
									</div>

									<button
										type="button"
										onclick={(event) => {
											event.stopPropagation();
											reviewItem(item);
										}}
										class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
									>
										<svg
											class="size-3.5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="1.8"
											aria-hidden="true"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="m12 3.75 2.47 5.004 5.522.803-3.996 3.895.943 5.5L12 16.354l-4.939 2.598.943-5.5-3.996-3.895 5.522-.803L12 3.75Z"
											/>
										</svg>
										review
									</button>
								</Command.Item>
							{/each}
						</Command.GroupItems>
					</Command.Group>
				{/if}
			</Command.Viewport>
		</Command.List>
	{/if}
</Command.Root>
