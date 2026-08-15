export const loginDialog = $state({
	open: false,

	show: () => {
		loginDialog.open = true;
	},

	hide: () => {
		loginDialog.open = false;
	}
});
