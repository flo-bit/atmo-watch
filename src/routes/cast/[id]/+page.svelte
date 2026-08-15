<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import Avatar from '$lib/components/Avatar.svelte';
	import Container from '$lib/components/Container.svelte';
	import ItemsGrid from '$lib/components/ItemsGrid.svelte';
	import { profileUrl } from '$lib/images';

	let { data }: { data: PageData } = $props();
	let showFullBiography = $state(false);
	let canonicalUrl = $derived(`${page.url.origin}${page.url.pathname}`);
	let description = $derived(
		data.personDetails.biography || `Movies and TV shows featuring ${data.personDetails.name}`
	);

	function calculateAge(birthday: string, deathday: string | null) {
		const birth = new Date(`${birthday}T00:00:00Z`);
		const end = deathday ? new Date(`${deathday}T00:00:00Z`) : new Date();
		let age = end.getUTCFullYear() - birth.getUTCFullYear();
		const birthdayHasPassed =
			end.getUTCMonth() > birth.getUTCMonth() ||
			(end.getUTCMonth() === birth.getUTCMonth() && end.getUTCDate() >= birth.getUTCDate());

		if (!birthdayHasPassed) age -= 1;
		return age;
	}
</script>

<svelte:head>
	<title>{data.personDetails.name} | skywatched</title>
	<meta name="description" content={description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:type" content="profile" />
	<meta property="og:title" content={`${data.personDetails.name} | skywatched`} />
	<meta property="og:description" content={description} />
	{#if data.personDetails.profile_path}
		<meta property="og:image" content={profileUrl(data.personDetails.profile_path, 'h632')} />
	{/if}
</svelte:head>

<Container class="relative z-10 pt-4 pb-8">
	<div class="flex items-center gap-4 px-4 pt-8">
		<Avatar
			src={profileUrl(data.personDetails.profile_path, 'h632')}
			alt={data.personDetails.name}
			class="size-44 shrink-0"
		/>

		<div class="flex flex-col gap-2">
			<h1 class="max-w-xl text-2xl font-semibold text-white sm:text-4xl">
				{data.personDetails.name}
			</h1>
			{#if data.personDetails.birthday}
				<p class="text-sm text-base-300">
					{calculateAge(data.personDetails.birthday, data.personDetails.deathday)} years old
				</p>
			{/if}
		</div>
	</div>

	<div class="px-4 pt-4 text-sm text-white">
		{#if data.personDetails.biography}
			<section class="mb-8 max-w-2xl">
				<h2 class="mb-2 text-lg font-semibold">overview</h2>
				<p class={showFullBiography ? '' : 'line-clamp-4'}>{data.personDetails.biography}</p>
				{#if !showFullBiography}
					<button
						class="mt-1 font-semibold text-accent-400"
						onclick={() => (showFullBiography = true)}
					>
						show more
					</button>
				{/if}
			</section>
		{/if}

		{#if data.combinedCredits.length > 0}
			<section class="mb-4 max-w-2xl">
				<h2 class="mb-2 text-lg font-semibold">appearing in</h2>
				<ItemsGrid items={data.combinedCredits} />
			</section>
		{/if}
	</div>
</Container>
