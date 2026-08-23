<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import './layout.css';
	import AppMenu from '$lib/components/AppMenu.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import LoginDialog from '$lib/components/LoginDialog.svelte';
	import ReviewDialog from '$lib/components/ReviewDialog.svelte';
	import CreateListDialog from '$lib/components/CreateListDialog.svelte';

	let { data, children } = $props();

	onNavigate((navigation) => {
		if (
			!document.startViewTransition ||
			document.documentElement.dataset.mediaTransition !== 'true'
		) {
			return;
		}

		delete document.documentElement.dataset.mediaTransition;
		return new Promise<void>((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<div class="flex min-h-dvh flex-col pb-20 md:pb-0">
	<div class="flex-1">
		{@render children()}
	</div>
	<Footer />
</div>

<AppMenu did={data.did} avatarUrl={data.avatarUrl} />
<LoginDialog />
<ReviewDialog />
<CreateListDialog />
