<script lang="ts">
	import { LegalDocument } from '@atmo-dev/kit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.document.title} | atmo.watch</title>
	{#if data.document.status !== 'published'}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

<main class="min-h-dvh md:pl-18">
	<LegalDocument document={data.document} />
</main>
