<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Modal, Button, Input, Textarea } from '@atmo-dev/kit';
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

<Modal
	bind:open={createListDialog.open}
	title="new list"
	class="max-w-sm bg-base-950 p-5 sm:p-5 [&_h2]:text-sm [&>header]:mb-4"
>
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
			<Input
				id="list-name"
				type="text"
				bind:value={name}
				oninput={markChanged}
				disabled={saving || saved}
				required
				maxlength={100}
				placeholder="list title"
				class="mt-2 min-h-9 bg-base-900 py-2 text-sm"
			/>

			<label for="list-description" class="mt-4 block text-xs font-medium text-base-300"
				>description</label
			>
			<Textarea
				id="list-description"
				bind:value={description}
				oninput={markChanged}
				disabled={saving || saved}
				rows={3}
				maxlength={500}
				placeholder="optional"
				class="mt-2 resize-none bg-base-900 text-sm"
			></Textarea>

			{#if listError}
				<p class="mt-3 text-sm text-red-300" role="alert">{listError}</p>
			{/if}

			<Button
				type="submit"
				disabled={!name.trim() || saving || saved}
				size="sm"
				class="mt-4 w-full"
			>
				{saving ? 'creating…' : saved ? 'created' : 'create list'}
			</Button>
		</form>
	{/if}
</Modal>
