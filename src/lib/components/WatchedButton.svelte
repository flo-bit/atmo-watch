<script lang="ts">
	import { Icon } from '@atmo-dev/kit';
	import { Check, LoaderCircle } from '@sketchyicons/svelte';
	import ActionTooltip from './ActionTooltip.svelte';
	import { posterUrl } from '$lib/images';
	import { setWatchedStatus, type MediaListState } from '$lib/list-write.remote';
	import { loginDialog } from '$lib/login.svelte';
	import type { MediaSummary } from '$lib/types';

	let {
		item,
		did,
		state: mediaState = null,
		loading = false,
		stateError = '',
		onStateChange = () => {}
	}: {
		item: MediaSummary;
		did: string | null;
		state?: MediaListState | null;
		loading?: boolean;
		stateError?: string;
		onStateChange?: (state: MediaListState) => void;
	} = $props();
	let watched = $derived(mediaState?.watched ?? false);
	let saving = $state(false);
	let statusError = $state('');
	let errorMessage = $derived(statusError || stateError);

	function setWatched(watched: boolean) {
		if (mediaState) onStateChange({ ...mediaState, watched });
	}

	async function toggleWatched() {
		if (!did) {
			loginDialog.show();
			return;
		}
		if (loading || saving) return;

		const previous = watched;
		const nextWatched = !previous;
		setWatched(nextWatched);
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
				watched: nextWatched
			});
			setWatched(result.watched);
		} catch (cause) {
			setWatched(previous);
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
	aria-label={watched ? 'Mark as unwatched' : 'Mark as watched'}
	aria-busy={loading || saving}
	class="group relative flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-2 text-center text-white transition-colors hover:text-accent-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:cursor-wait disabled:opacity-70 lg:gap-0 lg:p-0"
>
	<span
		class={`inline-flex size-10 items-center justify-center rounded-full border backdrop-blur-sm transition-colors lg:size-9 ${watched ? 'border-accent-400 bg-accent-400 text-base-950 group-hover:bg-accent-300' : 'border-white/10 bg-white/10 text-white group-hover:bg-white/15'}`}
	>
		{#if loading || saving}
			<Icon
				img={LoaderCircle}
				class="size-4 motion-safe:animate-spin"
				strokeWidth={1.8}
				aria-hidden="true"
			/>
		{:else}
			<Icon img={Check} class="size-4" strokeWidth={watched ? 2.2 : 1.8} aria-hidden="true" />
		{/if}
	</span>
	<span
		class={`text-xs leading-4 font-medium lg:sr-only ${errorMessage ? 'text-red-300' : 'text-base-200'}`}
	>
		{errorMessage ? 'try again' : watched ? 'mark unwatched' : 'mark as watched'}
	</span>
	<ActionTooltip label={errorMessage || (watched ? 'mark as unwatched' : 'mark as watched')} />
</button>
