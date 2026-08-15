import type { MediaKind } from './types';

export function cn(...classes: Array<string | false | null | undefined>) {
	return classes.filter(Boolean).join(' ');
}

export function isMediaKind(value: unknown): value is MediaKind {
	return value === 'movie' || value === 'tv';
}

export function parseTmdbId(value: string): number | null {
	const rawId = value.split('-', 1)[0];

	if (!/^\d+$/.test(rawId)) return null;

	const id = Number(rawId);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function slugify(value: string) {
	return (
		value
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 100) || 'item'
	);
}
