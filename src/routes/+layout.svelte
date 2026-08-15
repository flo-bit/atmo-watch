<script lang="ts">
	import './layout.css';
	import AppMenu from '$lib/components/AppMenu.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import LoginDialog from '$lib/components/LoginDialog.svelte';
	import ReviewDialog from '$lib/components/ReviewDialog.svelte';

	let { data, children } = $props();
</script>

<div class="flex min-h-dvh flex-col">
	<div class="flex-1">
		{@render children()}
	</div>
	<Footer />
</div>

<AppMenu did={data.did} />
<LoginDialog />
<ReviewDialog />
