import type { ResourceUri } from '@atcute/lexicons';
import { contrail } from '$lib/contrail-client.server';
import type * as VideoListRecords from '$lib/contrail/types/types/watch/atmo/video/listRecords';
import type { MediaVideo } from '$lib/types';
import { VIDEO_TYPE_LABELS, VIDEO_TYPES, type VideoType } from '$lib/videos';

export type SubmittedVideoQuery =
	| {
			creativeWorkType: 'movie' | 'tv_show' | 'tv_season' | 'tv_episode';
			tmdbId: number;
	  }
	| {
			tmdbTvSeriesId: number;
			seasonNumber?: number;
	  };

function videoTypeLabel(value: string) {
	if ((VIDEO_TYPES as readonly string[]).includes(value)) {
		return VIDEO_TYPE_LABELS[value as VideoType];
	}
	return value.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());
}

function parseTmdbIdentifier(value: string | undefined) {
	if (!value || !/^\d+$/.test(value)) return null;
	const id = Number(value);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function inferSeriesTitle(
	targetTitle: string,
	seasonNumber: number | undefined,
	episodeNumber: number | undefined
) {
	if (seasonNumber !== undefined && episodeNumber !== undefined) {
		const episodeMarker = `: S${seasonNumber} E${episodeNumber}`;
		const markerIndex = targetTitle.lastIndexOf(episodeMarker);
		if (markerIndex > 0) return targetTitle.slice(0, markerIndex).trim();
	}

	const separatorIndex = targetTitle.lastIndexOf(': ');
	return separatorIndex > 0 ? targetTitle.slice(0, separatorIndex).trim() : targetTitle;
}

function videoContext(value: VideoListRecords.Record['value']) {
	const tmdbId = parseTmdbIdentifier(value.identifiers.tmdbId);
	const title = value.title?.trim();
	if (!tmdbId || !title) return undefined;

	if (value.creativeWorkType === 'movie' || value.creativeWorkType === 'tv_show') {
		return { creativeWorkType: value.creativeWorkType, tmdbId, title };
	}

	const tmdbTvSeriesId = parseTmdbIdentifier(value.identifiers.tmdbTvSeriesId);
	const { seasonNumber, episodeNumber } = value.identifiers;
	if (
		!tmdbTvSeriesId ||
		seasonNumber === undefined ||
		(value.creativeWorkType === 'tv_episode' && episodeNumber === undefined)
	) {
		return undefined;
	}

	return {
		creativeWorkType: value.creativeWorkType,
		tmdbId,
		tmdbTvSeriesId,
		seasonNumber,
		...(value.creativeWorkType === 'tv_episode' && episodeNumber !== undefined
			? { episodeNumber }
			: {}),
		title,
		seriesTitle: inferSeriesTitle(title, seasonNumber, episodeNumber)
	};
}

type SubmittedVideoRecord = Pick<VideoListRecords.Record, 'uri' | 'did' | 'rkey' | 'value'>;

function toSubmittedVideos(
	records: SubmittedVideoRecord[],
	profiles: VideoListRecords.ProfileEntry[]
): MediaVideo[] {
	return records.map((record) => {
		const value = record.value;
		const videoType = videoTypeLabel(value.videoType);
		const handle = profiles.find((profile) => profile.did === record.did)?.handle;
		const targetTitle = value.title?.trim();
		const videoTitle = value.videoTitle?.trim();
		const channelName = value.channelName?.trim();
		const byline = [
			videoTitle ? targetTitle : null,
			channelName,
			handle ? `@${handle.replace(/^@/, '')}` : null
		]
			.filter((part): part is string => Boolean(part))
			.join(' · ');
		const context = videoContext(value);

		return {
			id: record.uri,
			key: value.youtubeId,
			name: videoTitle || `${targetTitle ? `${targetTitle} · ` : ''}${videoType}`,
			type: videoType,
			official: false,
			...(byline ? { byline } : {}),
			...(value.thumbnailUrl ? { thumbnailUrl: value.thumbnailUrl } : {}),
			containsSpoilers: value.containsSpoilers ?? false,
			...(context ? { context } : {}),
			recordAuthor: record.did,
			recordKey: record.rkey
		};
	});
}

export async function getSubmittedVideos(query: SubmittedVideoQuery): Promise<MediaVideo[]> {
	const response = await contrail.get('watch.atmo.video.listRecords', {
		params: {
			limit: 200,
			order: 'desc',
			profiles: true,
			...('tmdbId' in query
				? {
						creativeWorkType: query.creativeWorkType,
						identifiersTmdbId: String(query.tmdbId)
					}
				: {
						identifiersTmdbTvSeriesId: String(query.tmdbTvSeriesId),
						...(query.seasonNumber !== undefined
							? { identifiersSeasonNumber: String(query.seasonNumber) }
							: {})
					})
		}
	});
	if (!response.ok) throw new Error(`Could not load submitted videos (${response.status})`);

	return toSubmittedVideos(response.data.records, response.data.profiles ?? []);
}

export async function getMediaSubmittedVideos(
	tmdbId: number,
	creativeWorkType: 'movie' | 'tv_show'
) {
	const exactVideos = getSubmittedVideos({ tmdbId, creativeWorkType });
	if (creativeWorkType === 'movie') return exactVideos;

	const [showVideos, descendantVideos] = await Promise.all([
		exactVideos,
		getSubmittedVideos({ tmdbTvSeriesId: tmdbId })
	]);
	const seen = new Set<string>();
	return [...showVideos, ...descendantVideos].filter((video) => {
		if (seen.has(video.id)) return false;
		seen.add(video.id);
		return true;
	});
}

export async function getSubmittedVideo(uri: ResourceUri): Promise<MediaVideo | null> {
	const response = await contrail.get('watch.atmo.video.getRecord', { params: { uri } });
	if (!response.ok) {
		if (response.status === 400 || response.status === 404) return null;
		throw new Error(`Could not load video (${response.status})`);
	}
	return toSubmittedVideos([response.data], [])[0] ?? null;
}

export async function getRandomSubmittedScenes(limit = 24): Promise<MediaVideo[]> {
	const response = await contrail.get('watch.atmo.video.listRandomRecords', {
		params: { limit }
	});
	if (!response.ok) throw new Error(`Could not load random videos (${response.status})`);
	return toSubmittedVideos(response.data.records, []);
}
