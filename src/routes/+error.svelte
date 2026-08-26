<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Container from '$lib/components/Container.svelte';
	import DefaultOpenGraphImage from '$lib/components/DefaultOpenGraphImage.svelte';

	let title = $derived(page.status === 404 ? 'Page not found' : 'Something went wrong');
	let message = $derived(
		page.error?.message ||
			(page.status === 404
				? 'The page you are looking for does not exist.'
				: 'Please try again in a moment.')
	);
</script>

<svelte:head>
	<title>{page.status} — {title} | atmo.watch</title>
</svelte:head>

<DefaultOpenGraphImage />

<main class="min-h-dvh bg-base-950 text-base-50">
	<Container class="flex min-h-[75dvh] items-center px-4 py-16">
		<div class="max-w-md">
			<p class="text-sm font-medium text-accent-400">{page.status}</p>
			<h1 class="mt-2 text-2xl font-semibold text-white">{title}</h1>
			<p class="mt-3 text-sm text-base-400">{message}</p>
			<a
				href={resolve('/')}
				class="mt-6 inline-flex h-9 items-center rounded-lg bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
			>
				Back home
			</a>
		</div>
	</Container>
</main>
