import type { MediaSummary } from './types';

export const createListDialog: {
	open: boolean;
	item: MediaSummary | undefined;
	show: (item: MediaSummary) => void;
	hide: () => void;
} = $state({
	open: false,
	item: undefined,

	show: (item) => {
		createListDialog.item = item;
		createListDialog.open = true;
	},

	hide: () => {
		createListDialog.open = false;
	}
});
