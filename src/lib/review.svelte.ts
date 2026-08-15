import type { MediaSummary } from './types';
import { mediaKey } from './utils';

const REVIEW_STORAGE_PREFIX = 'atmo-review:';

export const reviewLibrary = $state({
	watchedMediaKeys: [] as string[],

	load: () => {
		const watchedMediaKeys: string[] = [];

		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index);
			if (!key?.startsWith(REVIEW_STORAGE_PREFIX)) continue;

			try {
				const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as { watched?: boolean };
				if (saved?.watched) watchedMediaKeys.push(key.slice(REVIEW_STORAGE_PREFIX.length));
			} catch {
				// Ignore malformed local reviews.
			}
		}

		reviewLibrary.watchedMediaKeys = watchedMediaKeys;
	},

	setWatched: (key: string, watched: boolean) => {
		if (watched && !reviewLibrary.watchedMediaKeys.includes(key)) {
			reviewLibrary.watchedMediaKeys = [...reviewLibrary.watchedMediaKeys, key];
		} else if (!watched) {
			reviewLibrary.watchedMediaKeys = reviewLibrary.watchedMediaKeys.filter(
				(mediaKey) => mediaKey !== key
			);
		}
	}
});

export const reviewDialog: {
	open: boolean;
	item: MediaSummary | undefined;
	show: (item: MediaSummary) => void;
	hide: () => void;
} = $state({
	open: false,
	item: undefined,

	show: (item) => {
		reviewDialog.item = item;
		reviewDialog.open = true;
	},

	hide: () => {
		reviewDialog.open = false;
	}
});

export function getReviewStorageKey(item: MediaSummary) {
	return `${REVIEW_STORAGE_PREFIX}${mediaKey(item)}`;
}
