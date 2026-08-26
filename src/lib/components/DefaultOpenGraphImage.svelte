<script lang="ts">
	const imageUrl = 'https://atmo.watch/og.png';
	const imageAlt = 'A curved wall of movie and TV posters with the atmo.watch wordmark.';
</script>

<svelte:head>
	<meta property="og:image" content={imageUrl} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={imageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={imageUrl} />
	<meta name="twitter:image:alt" content={imageAlt} />
</svelte:head>
