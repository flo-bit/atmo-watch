<script lang="ts">
	import Container from '../../_components/Container.svelte';
	import ItemsGrid from '../../_components/ItemsGrid.svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	$inspect(data);
</script>

<Container>
	{#if data?.items?.length > 0}
		<ItemsGrid items={data?.items} class="mt-6" />
	{:else}

	{/if}
</Container>
