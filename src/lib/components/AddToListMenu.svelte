<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { DropdownMenu } from 'bits-ui';
	import { untrack } from 'svelte';
	import { posterUrl } from '$lib/images';
	import { createListDialog } from '$lib/list.svelte';
	import { loadListOptions, toggleListMembership } from '$lib/list-write.remote';
	import { loginDialog } from '$lib/login.svelte';
	import type { MediaSummary } from '$lib/types';

	type ListOption = {
		uri: string;
		name: string;
		selected: boolean;
	};

	let { item, did }: { item: MediaSummary; did: string | null } = $props();
	let open = $state(false);
	let lists = $state<ListOption[]>([]);
	let loading = $state(false);
	let pendingUris = $state<string[]>([]);
	let listError = $state('');

	function mediaInput() {
		const imageUrl = posterUrl(item.poster, 'w500');
		return {
			creativeWorkType: item.creativeWorkType,
			tmdbId: item.tmdbId,
			title: item.title,
			...(imageUrl ? { posterUrl: imageUrl } : {})
		};
	}

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen && !did) {
			open = false;
			loginDialog.show();
			return;
		}

		open = nextOpen;
	}

	$effect(() => {
		if (!open || !did) return;

		lists = [];
		loading = true;
		listError = '';
		let cancelled = false;
		const request = untrack(() =>
			loadListOptions({
				creativeWorkType: item.creativeWorkType,
				tmdbId: item.tmdbId
			})
		);

		void request
			.then((result) => {
				if (!cancelled) lists = result.lists;
			})
			.catch((cause) => {
				if (cancelled) return;
				listError = cause instanceof Error ? cause.message : 'Could not load your lists.';
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	function setSelected(uri: string, selected: boolean) {
		lists = lists.map((list) => (list.uri === uri ? { ...list, selected } : list));
	}

	async function toggleList(list: ListOption, selected: boolean) {
		if (pendingUris.includes(list.uri) || selected === list.selected) return;

		const previous = list.selected;
		setSelected(list.uri, selected);
		pendingUris = [...pendingUris, list.uri];
		listError = '';

		try {
			await toggleListMembership({ media: mediaInput(), listUri: list.uri, selected });
			void invalidateAll();
		} catch (cause) {
			setSelected(list.uri, previous);
			listError = cause instanceof Error ? cause.message : 'Could not update the list.';
		} finally {
			pendingUris = pendingUris.filter((uri) => uri !== list.uri);
		}
	}

	function showCreateListDialog() {
		open = false;
		window.setTimeout(() => createListDialog.show(item), 0);
	}
</script>

<DropdownMenu.Root {open} onOpenChange={handleOpenChange}>
	<DropdownMenu.Trigger
		title="Add to list"
		class="inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.07] text-white backdrop-blur-sm transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 data-[state=open]:bg-white/[0.12]"
	>
		<svg
			class="size-4 text-accent-400"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			aria-hidden="true"
		>
			<path stroke-linecap="round" d="M16 5H3M11 12H3M16 19H3M18 9v6M21 12h-6" />
		</svg>
		<span class="sr-only">Add to list</span>
	</DropdownMenu.Trigger>

	<DropdownMenu.Portal>
		<DropdownMenu.Content
			side="bottom"
			align="end"
			sideOffset={8}
			avoidCollisions={false}
			loop={true}
			class="z-100 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-base-950/95 p-1.5 text-white shadow-2xl shadow-black/50 backdrop-blur-xl outline-none"
		>
			<DropdownMenu.Group aria-label="Your lists">
				<DropdownMenu.GroupHeading class="px-2.5 py-2 text-xs font-semibold text-base-400">
					add to list
				</DropdownMenu.GroupHeading>

				{#if loading}
					<div class="flex items-center gap-2 px-2.5 py-3 text-sm text-base-400" aria-live="polite">
						<svg
							class="size-4 animate-spin"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path stroke-linecap="round" d="M21 12a9 9 0 1 1-6.22-8.56" />
						</svg>
						loading lists…
					</div>
				{:else if lists.length > 0}
					<div class="max-h-48 overflow-y-auto">
						{#each lists as list (list.uri)}
							<DropdownMenu.CheckboxItem
								checked={list.selected}
								onCheckedChange={(checked) => void toggleList(list, checked)}
								closeOnSelect={false}
								disabled={pendingUris.includes(list.uri)}
								textValue={list.name}
								class="flex min-h-9 items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-disabled:opacity-50 data-highlighted:bg-white/10"
							>
								{#snippet children({ checked })}
									<span class="min-w-0 flex-1 truncate">{list.name}</span>
									<span class="flex size-4 shrink-0 items-center justify-center text-accent-400">
										{#if pendingUris.includes(list.uri)}
											<svg
												class="size-3.5 animate-spin"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												aria-hidden="true"
											>
												<path stroke-linecap="round" d="M21 12a9 9 0 1 1-6.22-8.56" />
											</svg>
										{:else if checked}
											<svg
												class="size-4"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												aria-hidden="true"
											>
												<path stroke-linecap="round" stroke-linejoin="round" d="m5 12 4 4L19 6" />
											</svg>
										{/if}
									</span>
								{/snippet}
							</DropdownMenu.CheckboxItem>
						{/each}
					</div>
				{:else if !listError}
					<div class="px-2.5 py-3 text-sm text-base-400">No lists yet.</div>
				{/if}
			</DropdownMenu.Group>

			{#if listError}
				<p class="px-2.5 py-2 text-xs text-red-300" role="alert">{listError}</p>
			{/if}

			<DropdownMenu.Separator class="my-1 h-px bg-white/10" />
			<DropdownMenu.Item
				onSelect={showCreateListDialog}
				class="flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium outline-none select-none data-highlighted:bg-white/10"
			>
				<svg
					class="size-4 text-accent-400"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path stroke-linecap="round" d="M12 5v14M5 12h14" />
				</svg>
				new list
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
