import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { createTID } from '@svelte-atproto/oauth/helper';
import * as v from 'valibot';
import { contrail } from '$lib/contrail-client.server';
import type { Main as VideoRecord } from '$lib/contrail/types/types/watch/atmo/alpha/video';
import { parseYouTubeVideo, VIDEO_TYPES } from '$lib/videos';

const VIDEO_COLLECTION = 'watch.atmo.alpha.video';

const targetSchema = v.pipe(
	v.object({
		creativeWorkType: v.picklist(['movie', 'tv_show', 'tv_season', 'tv_episode']),
		tmdbId: v.pipe(v.number(), v.integer(), v.minValue(1)),
		tmdbTvSeriesId: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
		seasonNumber: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
		episodeNumber: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
		title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1000))
	}),
	v.check((target) => {
		switch (target.creativeWorkType) {
			case 'movie':
			case 'tv_show':
				return (
					target.tmdbTvSeriesId === undefined &&
					target.seasonNumber === undefined &&
					target.episodeNumber === undefined
				);
			case 'tv_season':
				return (
					target.tmdbTvSeriesId !== undefined &&
					target.seasonNumber !== undefined &&
					target.episodeNumber === undefined
				);
			case 'tv_episode':
				return (
					target.tmdbTvSeriesId !== undefined &&
					target.seasonNumber !== undefined &&
					target.episodeNumber !== undefined
				);
		}
	}, 'The movie or TV target is incomplete')
);

const submitVideoSchema = v.object({
	target: targetSchema,
	videoUrl: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2048)),
	videoType: v.picklist(VIDEO_TYPES),
	containsSpoilers: v.boolean()
});

function responseMessage(data: unknown, fallback: string) {
	if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
		return data.message;
	}
	return fallback;
}

function optionalHttpsUrl(value: unknown) {
	if (typeof value !== 'string' || value.length > 2048) return undefined;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' ? url.toString() : undefined;
	} catch {
		return undefined;
	}
}

async function getYouTubeMetadata(videoUrl: string) {
	const endpoint = new URL('https://www.youtube.com/oembed');
	endpoint.searchParams.set('url', videoUrl);
	endpoint.searchParams.set('format', 'json');

	let response: Response;
	try {
		response = await fetch(endpoint, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(10_000)
		});
	} catch {
		error(502, 'Could not reach YouTube to load the video details');
	}

	if ([400, 401, 403, 404].includes(response.status)) {
		error(422, 'YouTube could not find a public video at that link');
	}
	if (!response.ok) error(502, 'YouTube could not load the video details');

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		error(502, 'YouTube returned invalid video details');
	}
	if (!data || typeof data !== 'object') error(502, 'YouTube returned invalid video details');

	const title = 'title' in data && typeof data.title === 'string' ? data.title.trim() : '';
	if (!title || title.length > 500) error(502, 'YouTube returned an invalid video title');

	const channelName =
		'author_name' in data && typeof data.author_name === 'string'
			? data.author_name.trim().slice(0, 500)
			: '';
	const channelUrl = 'author_url' in data ? optionalHttpsUrl(data.author_url) : undefined;
	const thumbnailUrl = 'thumbnail_url' in data ? optionalHttpsUrl(data.thumbnail_url) : undefined;

	return {
		videoTitle: title,
		...(channelName ? { channelName } : {}),
		...(channelUrl ? { channelUrl } : {}),
		...(thumbnailUrl ? { thumbnailUrl } : {})
	};
}

export const submitVideo = command(
	submitVideoSchema,
	async ({ target, videoUrl, videoType, containsSpoilers }) => {
		const { locals } = getRequestEvent();
		if (!locals.client || !locals.did) error(401, 'Log in to submit a video');

		const youtube = parseYouTubeVideo(videoUrl);
		if (!youtube) error(422, 'Enter a valid YouTube video link');
		const youtubeMetadata = await getYouTubeMetadata(youtube.videoUrl);

		const identifiers = {
			tmdbId: String(target.tmdbId),
			...(target.tmdbTvSeriesId !== undefined
				? { tmdbTvSeriesId: String(target.tmdbTvSeriesId) }
				: {}),
			...(target.seasonNumber !== undefined ? { seasonNumber: target.seasonNumber } : {}),
			...(target.episodeNumber !== undefined ? { episodeNumber: target.episodeNumber } : {})
		};
		const record = {
			$type: VIDEO_COLLECTION,
			videoUrl: youtube.videoUrl,
			youtubeId: youtube.youtubeId,
			...youtubeMetadata,
			videoType,
			creativeWorkType: target.creativeWorkType,
			identifiers,
			title: target.title,
			containsSpoilers,
			createdAt: new Date().toISOString()
		} as VideoRecord;

		const response = await contrail
			.authenticated(locals.client)
			.post('com.atproto.repo.createRecord', {
				input: {
					repo: locals.did,
					collection: VIDEO_COLLECTION,
					rkey: createTID(),
					record
				}
			});
		if (!response.ok) {
			error(response.status, responseMessage(response.data, 'Could not submit the video'));
		}

		return { uri: response.data.uri };
	}
);
