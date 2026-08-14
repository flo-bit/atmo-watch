import type { Item, TmdbRef } from './types';

export const reviewLibrary = $state({
	watchedRefs: [] as TmdbRef[],

	load: () => {
		const watched = new Set<TmdbRef>();

		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index);
			if (!key?.startsWith('atmo-review:')) continue;

			try {
				const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as { watched?: boolean };
				if (saved?.watched) watched.add(key.slice('atmo-review:'.length) as TmdbRef);
			} catch {
				// Ignore malformed local reviews.
			}
		}

		reviewLibrary.watchedRefs = [...watched];
	},

	setWatched: (ref: TmdbRef, watched: boolean) => {
		const refs = new Set(reviewLibrary.watchedRefs);
		if (watched) refs.add(ref);
		else refs.delete(ref);
		reviewLibrary.watchedRefs = [...refs];
	}
});

export const reviewDialog: {
	open: boolean;
	item: Item | undefined;
	show: (item: Item) => void;
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
