<script lang="ts">
	import { resolve } from '$app/paths';
	import { Icon } from '@atmo-dev/kit';
	import { ArrowRight, Blend, Users } from '@sketchyicons/svelte';
	import Container from '$lib/components/Container.svelte';
	import DefaultOpenGraphImage from '$lib/components/DefaultOpenGraphImage.svelte';
</script>

<svelte:head>
	<title>Tools | atmo.watch</title>
	<meta name="description" content="Small tools for finding something to watch." />
</svelte:head>

<DefaultOpenGraphImage />

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<Container class="px-4 pt-8 pb-16 sm:pt-12">
		<h1 class="text-2xl font-semibold tracking-tight">Tools</h1>
		<div class="mt-6 grid gap-3 sm:grid-cols-2">
			<a
				href={resolve('/tools/mix')}
				class="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-accent-500/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
			>
				<Icon img={Blend} class="size-6 shrink-0" />
				<div class="min-w-0 flex-1">
					<h2 class="font-semibold">Mix</h2>
					<p class="mt-0.5 text-sm text-base-400">Pick titles you like, get more to watch.</p>
				</div>
				<Icon img={ArrowRight} class="size-5 shrink-0 text-base-400" />
			</a>
			<a
				href={resolve('/tools/together')}
				class="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-accent-500/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
			>
				<Icon img={Users} class="size-6 shrink-0" />
				<div class="min-w-0 flex-1">
					<h2 class="font-semibold">Watch together</h2>
					<p class="mt-0.5 text-sm text-base-400">Find something everyone wants to watch.</p>
				</div>
				<Icon img={ArrowRight} class="size-5 shrink-0 text-base-400" />
			</a>
		</div>
	</Container>
</main>
