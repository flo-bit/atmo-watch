<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import AppMenu from '$lib/components/AppMenu.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import LoginDialog from '$lib/components/LoginDialog.svelte';
	import ReviewDialog from '$lib/components/ReviewDialog.svelte';
	import { reviewLibrary } from '$lib/review.svelte';

	let { data, children } = $props();

	onMount(() => reviewLibrary.load());
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
