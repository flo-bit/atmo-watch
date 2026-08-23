import type { MediaImage } from './types';

export const VIDEO_TYPES = [
	'trailer',
	'teaser',
	'scene',
	'clip',
	'deleted_scene',
	'featurette',
	'behind_the_scenes',
	'interview',
	'blooper',
	'supercut',
	'recap',
	'review',
	'analysis',
	'reaction',
	'fan_edit',
	'other'
] as const;

export type VideoType = (typeof VIDEO_TYPES)[number];
export type VideoCreativeWorkType = 'movie' | 'tv_show' | 'tv_season' | 'tv_episode';

export const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
	trailer: 'Trailer',
	teaser: 'Teaser',
	scene: 'Scene',
	clip: 'Clip',
	deleted_scene: 'Deleted scene',
	featurette: 'Featurette',
	behind_the_scenes: 'Behind the scenes',
	interview: 'Interview',
	blooper: 'Blooper',
	supercut: 'Supercut',
	recap: 'Recap',
	review: 'Review',
	analysis: 'Analysis',
	reaction: 'Reaction',
	fan_edit: 'Fan edit',
	other: 'Other'
};

export type VideoEpisodeOption = {
	tmdbId: number;
	tmdbTvSeriesId: number;
	seasonNumber: number;
	episodeNumber: number;
	title: string;
	label: string;
};

export type VideoTarget = {
	creativeWorkType: VideoCreativeWorkType;
	tmdbId: number;
	tmdbTvSeriesId?: number;
	seasonNumber?: number;
	episodeNumber?: number;
	title: string;
	poster: MediaImage | null;
	episodeOptions?: VideoEpisodeOption[];
};

export type YouTubeVideo = {
	youtubeId: string;
	videoUrl: string;
};

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
	'youtube.com',
	'www.youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com'
]);

export function parseYouTubeVideo(value: string): YouTubeVideo | null {
	try {
		const url = new URL(value.trim());
		if (url.protocol !== 'https:') return null;

		const hostname = url.hostname.toLowerCase();
		let youtubeId: string | null = null;

		if (hostname === 'youtu.be') {
			youtubeId = url.pathname.split('/').filter(Boolean)[0] ?? null;
		} else if (YOUTUBE_HOSTS.has(hostname)) {
			const segments = url.pathname.split('/').filter(Boolean);
			if (url.pathname === '/watch') youtubeId = url.searchParams.get('v');
			else if (['embed', 'live', 'shorts'].includes(segments[0])) youtubeId = segments[1] ?? null;
		}

		if (!youtubeId || !YOUTUBE_ID_PATTERN.test(youtubeId)) return null;
		return {
			youtubeId,
			videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`
		};
	} catch {
		return null;
	}
}
