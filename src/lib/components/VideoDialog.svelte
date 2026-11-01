<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Modal, Button, Input, Select, Checkbox } from '@atmo-dev/kit';
	import { posterUrl } from '$lib/images';
	import { videoDialog } from '$lib/video.svelte';
	import { submitVideo } from '$lib/video-write.remote';
	import { VIDEO_TYPE_LABELS, VIDEO_TYPES, type VideoTarget, type VideoType } from '$lib/videos';

	let videoUrl = $state('');
	let videoType = $state<VideoType>('trailer');
	let selectedEpisodeId = $state('');
	let containsSpoilers = $state(false);
	let saving = $state(false);
	let saved = $state(false);
	let videoError = $state('');

	$effect(() => {
		const target = videoDialog.target;
		if (!videoDialog.open || !target) return;

		videoUrl = '';
		videoType = target.creativeWorkType === 'tv_episode' ? 'scene' : 'trailer';
		selectedEpisodeId = '';
		containsSpoilers = false;
		saving = false;
		saved = false;
		videoError = '';
	});

	function markChanged() {
		saved = false;
		videoError = '';
	}

	function getSubmissionTarget(): VideoTarget | undefined {
		const target = videoDialog.target;
		if (!target || !selectedEpisodeId) return target;

		const episode = target.episodeOptions?.find(
			(option) => String(option.tmdbId) === selectedEpisodeId
		);
		if (!episode) return target;

		return {
			creativeWorkType: 'tv_episode',
			tmdbId: episode.tmdbId,
			tmdbTvSeriesId: episode.tmdbTvSeriesId,
			seasonNumber: episode.seasonNumber,
			episodeNumber: episode.episodeNumber,
			title: episode.title,
			poster: target.poster
		};
	}

	let submissionTarget = $derived(getSubmissionTarget());

	function targetTypeLabel(target: VideoTarget | undefined) {
		switch (target?.creativeWorkType) {
			case 'movie':
				return 'Movie';
			case 'tv_show':
				return 'TV series';
			case 'tv_season':
				return 'TV season';
			case 'tv_episode':
				return 'TV episode';
			default:
				return '';
		}
	}

	async function saveVideo(event: SubmitEvent) {
		event.preventDefault();
		const target = submissionTarget;
		if (!target || !videoUrl.trim() || saving) return;

		saving = true;
		saved = false;
		videoError = '';

		try {
			await submitVideo({
				target: {
					creativeWorkType: target.creativeWorkType,
					tmdbId: target.tmdbId,
					...(target.tmdbTvSeriesId !== undefined ? { tmdbTvSeriesId: target.tmdbTvSeriesId } : {}),
					...(target.seasonNumber !== undefined ? { seasonNumber: target.seasonNumber } : {}),
					...(target.episodeNumber !== undefined ? { episodeNumber: target.episodeNumber } : {}),
					title: target.title
				},
				videoUrl,
				videoType,
				containsSpoilers
			});
			saved = true;
			void invalidateAll();
			window.setTimeout(() => videoDialog.hide(), 500);
		} catch (cause) {
			videoError = cause instanceof Error ? cause.message : 'Could not submit the video.';
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	bind:open={videoDialog.open}
	title="submit a video"
	class="max-w-sm bg-base-950 p-5 sm:p-5 [&_h2]:text-sm [&>header]:mb-4"
>
	{#if videoDialog.target && submissionTarget}
		<div class="mt-5 flex items-center gap-4">
			<div class="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-base-900">
				{#if submissionTarget.poster}
					<img
						src={posterUrl(submissionTarget.poster, 'w185')}
						alt="Poster for {submissionTarget.title}"
						class="size-full object-cover"
					/>
				{/if}
			</div>
			<div class="min-w-0">
				<div class="line-clamp-2 font-semibold">{submissionTarget.title}</div>
				<div class="mt-1 text-xs text-base-400">{targetTypeLabel(submissionTarget)}</div>
			</div>
		</div>

		<form onsubmit={saveVideo} class="mt-4">
			{#if videoDialog.target.episodeOptions?.length}
				<label for="video-episode" class="text-xs font-medium text-base-300">belongs to</label>
				<Select
					id="video-episode"
					bind:value={selectedEpisodeId}
					onchange={markChanged}
					disabled={saving || saved}
					class="mt-2 block h-9 w-full rounded-lg border border-white/10 bg-base-900 px-3 text-sm text-white outline-none focus:border-white/25 focus:ring-0 disabled:cursor-wait"
				>
					<option value="">Entire season</option>
					{#each videoDialog.target.episodeOptions as episode (episode.tmdbId)}
						<option value={String(episode.tmdbId)}>{episode.label}</option>
					{/each}
				</Select>
			{/if}

			<label
				for="video-url"
				class={videoDialog.target.episodeOptions?.length
					? 'mt-4 block text-xs font-medium text-base-300'
					: 'text-xs font-medium text-base-300'}>YouTube link</label
			>
			<Input
				id="video-url"
				type="url"
				bind:value={videoUrl}
				oninput={markChanged}
				disabled={saving || saved}
				required
				maxlength={2048}
				placeholder="https://www.youtube.com/watch?v=…"
				class="mt-2 min-h-9 bg-base-900 py-2 text-sm"
			/>

			<label for="video-type" class="mt-4 block text-xs font-medium text-base-300">video type</label
			>
			<Select
				id="video-type"
				bind:value={videoType}
				onchange={markChanged}
				disabled={saving || saved}
				class="mt-2 block h-9 w-full rounded-lg border border-white/10 bg-base-900 px-3 text-sm text-white outline-none focus:border-white/25 focus:ring-0 disabled:cursor-wait"
			>
				{#each VIDEO_TYPES as type (type)}
					<option value={type}>{VIDEO_TYPE_LABELS[type]}</option>
				{/each}
			</Select>

			<label class="mt-4 flex w-fit cursor-pointer items-center gap-2 text-xs text-base-300">
				<Checkbox
					bind:checked={containsSpoilers}
					onchange={markChanged}
					disabled={saving || saved}
				/>
				contains spoilers
			</label>

			{#if videoError}
				<p class="mt-3 text-sm text-red-300" role="alert">{videoError}</p>
			{/if}

			<Button
				type="submit"
				disabled={!videoUrl.trim() || saving || saved}
				size="sm"
				class="mt-4 w-full"
			>
				{saving ? 'submitting…' : saved ? 'submitted' : 'submit video'}
			</Button>
		</form>
	{/if}
</Modal>
