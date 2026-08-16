<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Dialog } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import { posterUrl } from '$lib/images';
	import { createListDialog } from '$lib/list.svelte';
	import { createListWithItem } from '$lib/list-write.remote';

	let name = $state('');
	let description = $state('');
	let saving = $state(false);
	let saved = $state(false);
	let listError = $state('');

	$effect(() => {
		if (!createListDialog.open || !createListDialog.item) return;

		name = '';
		description = '';
		saving = false;
		saved = false;
		listError = '';
	});

	function markChanged() {
		saved = false;
		listError = '';
	}

	async function createList(event: SubmitEvent) {
		event.preventDefault();
		const item = createListDialog.item;
		if (!item || !name.trim() || saving) return;

		saving = true;
		saved = false;
		listError = '';

		try {
			const imageUrl = posterUrl(item.poster, 'w500');
			await createListWithItem({
				media: {
					creativeWorkType: item.creativeWorkType,
					tmdbId: item.tmdbId,
					title: item.title,
					...(imageUrl ? { posterUrl: imageUrl } : {})
				},
				name,
				description
			});
			saved = true;
			void invalidateAll();
			window.setTimeout(() => createListDialog.hide(), 500);
		} catch (cause) {
			listError = cause instanceof Error ? cause.message : 'Could not create list.';
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root
	bind:open={createListDialog.open}
	onOpenChange={(open) => !open && createListDialog.hide()}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-100 bg-black/75 backdrop-blur-md" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-101 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-base-950 p-5 text-white shadow-2xl outline-none"
		>
			<Dialog.Title class="text-sm font-semibold">new list</Dialog.Title>
			<Dialog.Description class="sr-only">
				Create a list and add this movie or TV show to it.
			</Dialog.Description>

			<Dialog.Close
				class="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-full text-base-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
			>
				<X class="size-4" strokeWidth={1.5} aria-hidden="true" />
				<span class="sr-only">Close new list</span>
			</Dialog.Close>

			{#if createListDialog.item}
				<div class="mt-5 flex items-center gap-4">
					<div class="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-base-900">
						{#if createListDialog.item.poster}
							<img
								src={posterUrl(createListDialog.item.poster, 'w185')}
								alt="Poster for {createListDialog.item.title}"
								class="size-full object-cover"
							/>
						{/if}
					</div>
					<div class="min-w-0">
						<div class="truncate font-semibold">{createListDialog.item.title}</div>
						<div class="mt-1 text-xs text-base-400">
							{createListDialog.item.creativeWorkType === 'tv_show' ? 'TV series' : 'Movie'}
						</div>
					</div>
				</div>

				<form onsubmit={createList} class="mt-4">
					<label for="list-name" class="text-xs font-medium text-base-300">title</label>
					<input
						id="list-name"
						type="text"
						bind:value={name}
						oninput={markChanged}
						disabled={saving || saved}
						required
						maxlength="100"
						placeholder="list title"
						class="mt-2 block h-9 w-full rounded-lg border border-white/10 bg-base-900 px-3 text-sm text-white outline-none placeholder:text-base-500 focus:border-white/25 focus:ring-0 disabled:cursor-wait"
					/>

					<label for="list-description" class="mt-4 block text-xs font-medium text-base-300"
						>description</label
					>
					<textarea
						id="list-description"
						bind:value={description}
						oninput={markChanged}
						disabled={saving || saved}
						rows="3"
						maxlength="500"
						placeholder="optional"
						class="mt-2 block w-full resize-none rounded-lg border border-white/10 bg-base-900 px-3 py-2 text-sm text-white outline-none placeholder:text-base-500 focus:border-white/25 focus:ring-0 disabled:cursor-wait"
					></textarea>

					{#if listError}
						<p class="mt-3 text-sm text-red-300" role="alert">{listError}</p>
					{/if}

					<button
						type="submit"
						disabled={!name.trim() || saving || saved}
						class="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg border border-accent-900 bg-accent-950/80 text-sm font-semibold text-accent-300 transition-colors hover:bg-accent-950 disabled:cursor-not-allowed disabled:opacity-40"
					>
						{saving ? 'creating…' : saved ? 'created' : 'create list'}
					</button>
				</form>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
