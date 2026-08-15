<script lang="ts">
	import type { PageData } from './$types';
	import ItemPage from '$lib/components/ItemPage.svelte';

	let { data }: { data: PageData } = $props();
</script>

<ItemPage {data} />
