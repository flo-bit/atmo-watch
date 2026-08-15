import {
	ImageAPI,
	type BackdropSize,
	type LogoSize,
	type PosterSize,
	type ProfileSize
} from '@lorenzopant/tmdb/image';
import type { MediaImage } from './types';

const images = new ImageAPI();

export function backdropUrl(image: MediaImage | null | undefined, size: BackdropSize = 'w1280') {
	if (!image) return undefined;
	return image.source === 'tmdb' ? images.backdrop(image.path, size) : image.url;
}

export function logoUrl(path: string | null | undefined, size: LogoSize = 'w92') {
	return path ? images.logo(path, size) : undefined;
}

export function posterUrl(image: MediaImage | null | undefined, size: PosterSize = 'w500') {
	if (!image) return undefined;
	return image.source === 'tmdb' ? images.poster(image.path, size) : image.url;
}

export function profileUrl(path: string | null | undefined, size: ProfileSize = 'h632') {
	return path ? images.profile(path, size) : undefined;
}
