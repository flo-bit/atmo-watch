import {
	ImageAPI,
	type BackdropSize,
	type LogoSize,
	type PosterSize,
	type ProfileSize
} from '@lorenzopant/tmdb/image';

const images = new ImageAPI();

export function backdropUrl(path: string | null | undefined, size: BackdropSize = 'w1280') {
	return path ? images.backdrop(path, size) : undefined;
}

export function logoUrl(path: string | null | undefined, size: LogoSize = 'w92') {
	return path ? images.logo(path, size) : undefined;
}

export function posterUrl(path: string | null | undefined, size: PosterSize = 'w500') {
	if (path?.startsWith('https://')) return path;
	return path ? images.poster(path, size) : undefined;
}

export function profileUrl(path: string | null | undefined, size: ProfileSize = 'h632') {
	return path ? images.profile(path, size) : undefined;
}
