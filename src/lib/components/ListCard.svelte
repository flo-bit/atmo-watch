<script lang="ts">
	import { resolve } from '$app/paths';
	import { posterUrl } from '$lib/images';
	import type { MediaListModel } from '$lib/types';

	let { list }: { list: MediaListModel } = $props();
	let listUrl = $derived(
		resolve('/profile/[actor]/list/[rkey]', {
			actor: list.author.did,
			rkey: list.rkey
		})
	);
</script>

<article class="group min-w-0">
	<a
		href={listUrl}
		class="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
	>
		<div
			class="grid h-32 grid-cols-4 gap-1 overflow-hidden rounded-lg bg-base-900 p-1 transition-opacity group-hover:opacity-75 sm:h-36"
		>
			{#each list.previewItems as item, index (`${item.creativeWorkType}:${item.tmdbId}:${index}`)}
				<div class="min-w-0 overflow-hidden rounded-sm bg-base-800">
					{#if item.poster}
						<img
							src={posterUrl(item.poster, 'w185')}
							alt=""
							class="size-full object-cover"
							loading="lazy"
						/>
					{/if}
				</div>
			{/each}
		</div>

		<h3
			class="mt-3 truncate text-sm font-semibold text-white transition-colors group-hover:text-accent-300"
		>
			{list.name}
		</h3>
		<p class="mt-1 text-xs text-base-500">
			{list.itemCount}
			{list.itemCount === 1 ? 'item' : 'items'}
		</p>
	</a>
</article>
