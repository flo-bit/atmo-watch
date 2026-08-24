<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { CircleCheck, LoaderCircle } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import ActionTooltip from './ActionTooltip.svelte';
	import { posterUrl } from '$lib/images';
	import { loadWatchedStatus, setWatchedStatus } from '$lib/list-write.remote';
	import { loginDialog } from '$lib/login.svelte';
	import type { MediaSummary } from '$lib/types';

	let { item, did }: { item: MediaSummary; did: string | null } = $props();
	let watched = $state(false);
	let loading = $state(false);
	let saving = $state(false);
	let statusError = $state('');

	$effect(() => {
		const creativeWorkType = item.creativeWorkType;
		const tmdbId = item.tmdbId;
		if (!did) {
			watched = false;
			loading = false;
			return;
		}

		loading = true;
		statusError = '';
		let cancelled = false;
		const request = untrack(() => loadWatchedStatus({ creativeWorkType, tmdbId }));

		void request
			.then((result) => {
				if (!cancelled) watched = result.watched;
			})
			.catch((cause) => {
				if (cancelled) return;
				statusError = cause instanceof Error ? cause.message : 'Could not load watched status.';
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	async function toggleWatched() {
		if (!did) {
			loginDialog.show();
			return;
		}
		if (loading || saving) return;

		const previous = watched;
		watched = !watched;
		saving = true;
		statusError = '';

		try {
			const imageUrl = posterUrl(item.poster, 'w500');
			const result = await setWatchedStatus({
				media: {
					creativeWorkType: item.creativeWorkType,
					tmdbId: item.tmdbId,
					title: item.title,
					...(imageUrl ? { posterUrl: imageUrl } : {})
				},
				watched
			});
			watched = result.watched;
			void invalidateAll();
		} catch (cause) {
			watched = previous;
			statusError = cause instanceof Error ? cause.message : 'Could not update watched status.';
		} finally {
			saving = false;
		}
	}
</script>

<button
	type="button"
	onclick={toggleWatched}
	disabled={Boolean(did) && (loading || saving)}
	aria-pressed={watched}
	class="group relative flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-2 text-center text-white transition-colors hover:text-accent-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:cursor-wait disabled:opacity-70 lg:gap-0 lg:p-0"
>
	<span
		class={`inline-flex size-10 items-center justify-center rounded-full border shadow-lg shadow-black/10 backdrop-blur-sm transition-colors group-hover:bg-white/15 lg:size-9 ${watched ? 'border-accent-400/50 bg-accent-500 text-white' : 'border-white/10 bg-white/10 text-white'}`}
	>
		{#if loading || saving}
			<LoaderCircle class="size-4 animate-spin" strokeWidth={1.8} aria-hidden="true" />
		{:else}
			<CircleCheck class="size-4" strokeWidth={watched ? 2.2 : 1.8} aria-hidden="true" />
		{/if}
	</span>
	<span
		class={`text-xs leading-4 font-medium lg:sr-only ${statusError ? 'text-red-300' : 'text-base-200'}`}
	>
		{statusError ? 'try again' : watched ? 'mark unwatched' : 'mark as watched'}
	</span>
	<ActionTooltip label={statusError || (watched ? 'mark as unwatched' : 'mark as watched')} />
</button>
