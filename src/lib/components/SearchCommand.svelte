<script lang="ts">
	import { goto } from '$app/navigation';
	import { Command } from 'bits-ui';
	import { posterUrl } from '$lib/images';
	import { reviewDialog } from '$lib/review.svelte';
	import type { Item } from '$lib/types';
	import { cn, slugify } from '$lib/utils';

	let {
		autofocus = true,
		class: className,
		onReview = (item: Item) => reviewDialog.show(item)
	}: {
		autofocus?: boolean;
		class?: string;
		onReview?: (item: Item) => void;
	} = $props();

	let query = $state('');
	let results = $state<Item[]>([]);
	let searching = $state(false);
	let hasSearched = $state(false);
	let searchError = $state('');
	let resultsOpen = $state(false);

	function itemUrl(item: Item) {
		return `/${item.media_type}/${item.id}-${slugify(item.title)}`;
	}

	function handleFocusOut(event: FocusEvent) {
		const root = event.currentTarget as HTMLElement;
		const next = event.relatedTarget;

		if (!(next instanceof Node) || !root.contains(next)) {
			resultsOpen = false;
		}
	}

	async function search(term: string, controller: AbortController) {
		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
				signal: controller.signal
			});

			if (!response.ok) {
				throw new Error('Search is unavailable right now');
			}

			const items = (await response.json()) as Item[];
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
	shouldFilter={false}
	onfocusin={() => (resultsOpen = true)}
	onfocusout={handleFocusOut}
	loop={true}
	label="Search movies and TV shows"
	class={cn(
		'focus-within:border-accent-500/50 relative z-50 rounded-2xl border border-white/10 bg-black/40 shadow-2xl shadow-black/40 backdrop-blur-xl transition-colors',
		className
	)}
>
	<div class="flex h-16 items-center gap-3 px-4">
		<svg
			class="text-base-400 size-5 shrink-0"
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
			class="placeholder:text-base-500 h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-lg font-medium text-white shadow-none ring-0 outline-none focus:border-0 focus:ring-0 focus:outline-none"
		/>

		{#if searching}
			<svg
				class="text-accent-400 size-5 animate-spin"
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
			class="bg-base-950/95 absolute top-[calc(100%+0.5rem)] right-0 left-0 z-50 max-h-96 overflow-y-auto rounded-2xl border border-white/10 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
		>
			<Command.Viewport>
				{#if searching}
					<Command.Loading
						progress={0}
						class="text-base-400 flex items-center justify-center px-4 py-8 text-sm"
					>
						Searching…
					</Command.Loading>
				{:else if searchError}
					<div class="px-4 py-8 text-center text-sm text-red-400" role="alert">
						{searchError}
					</div>
				{:else if hasSearched && results.length === 0}
					<Command.Empty forceMount class="text-base-400 px-4 py-8 text-center text-sm">
						No movies or TV shows found.
					</Command.Empty>
				{:else if results.length > 0}
					<Command.Group value="Search results">
						<Command.GroupHeading class="sr-only">Search results</Command.GroupHeading>
						<Command.GroupItems class="flex flex-col gap-1">
							{#each results as item (`${item.media_type}-${item.id}`)}
								<Command.Item
									onSelect={() => void goto(itemUrl(item))}
									value={`${item.title} ${item.media_type} ${item.id}`}
									keywords={[item.title, item.media_type]}
									class="flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-colors outline-none data-selected:bg-white/10"
								>
									<div
										class="bg-base-900 h-18 w-12 shrink-0 overflow-hidden rounded-md border border-white/10"
									>
										{#if item.poster_path}
											<img
												src={posterUrl(item.poster_path, 'w185')}
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
											onReview(item);
										}}
										class="bg-accent-500 hover:bg-accent-400 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
									>
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
