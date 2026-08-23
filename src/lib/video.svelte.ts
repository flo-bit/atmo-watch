import type { VideoTarget } from './videos';

export const videoDialog: {
	open: boolean;
	target: VideoTarget | undefined;
	show: (target: VideoTarget) => void;
	hide: () => void;
} = $state({
	open: false,
	target: undefined,

	show: (target) => {
		videoDialog.target = target;
		videoDialog.open = true;
	},

	hide: () => {
		videoDialog.open = false;
	}
});
