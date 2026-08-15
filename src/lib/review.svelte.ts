import type { MediaSummary } from './types';

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
