<script lang="ts">
	import { onMount } from 'svelte';
	import { reviewLibrary } from './_lib/review.svelte';
	import AppMenu from './_components/AppMenu.svelte';
	import Footer from './_components/Footer.svelte';
	import ReviewDialog from './_components/ReviewDialog.svelte';

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
<ReviewDialog />
