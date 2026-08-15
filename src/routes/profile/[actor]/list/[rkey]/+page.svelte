<script lang="ts">
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/Avatar.svelte';
	import Container from '$lib/components/Container.svelte';
	import ItemCard from '$lib/components/ItemCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let profileUrl = $derived(resolve('/profile/[actor]', { actor: data.list.author.did }));
	let listUrl = $derived(
		resolve('/profile/[actor]/list/[rkey]', {
			actor: data.list.author.did,
			rkey: data.list.rkey
		})
	);
	let handle = $derived(data.list.author.handle.replace(/^@/, ''));

	const dateFormatter = new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeZone: 'UTC'
	});

	function formatDate(value: string) {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
	}
</script>

<svelte:head>
	<title>{data.list.name} by @{handle} | atmo.watch</title>
	<meta
		name="description"
		content={data.list.description || `${data.list.name}, a movie and TV list by @${handle}.`}
	/>
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-16 text-base-50">
	<Container class="px-4 pt-10 sm:pt-14">
		<header class="max-w-2xl">
			<h1 class="text-3xl leading-tight font-semibold text-white sm:text-4xl">{data.list.name}</h1>

			{#if data.list.description}
				<p class="mt-4 text-sm leading-6 whitespace-pre-wrap text-base-300">
					{data.list.description}
				</p>
			{/if}

			<div class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-xs text-base-500">
				<a
					href={profileUrl}
					class="flex items-center gap-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
				>
					<Avatar
						src={data.list.author.avatarUrl}
						alt={`@${handle}'s avatar`}
						class="size-8 shrink-0"
					/>
					<span class="font-semibold text-base-200">@{handle}</span>
				</a>
				<span>{data.list.itemCount} {data.list.itemCount === 1 ? 'item' : 'items'}</span>
				<time datetime={data.list.createdAt}>{formatDate(data.list.createdAt)}</time>
			</div>
		</header>

		{#if data.items.length > 0}
			<div class="mt-10 grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-5">
				{#each data.items as item, index (`${item.creativeWorkType}:${item.tmdbId}:${index}`)}
					<ItemCard {item} />
				{/each}
			</div>

			{#if data.totalPages > 1}
				<nav class="mt-12 flex items-center justify-center gap-5 text-sm" aria-label="List pages">
					{#if data.currentPage > 1}
						<a
							href={`${listUrl}?page=${data.currentPage - 1}`}
							class="text-base-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
						>
							previous
						</a>
					{/if}
					<span class="text-xs text-base-500">
						{data.currentPage} / {data.totalPages}
					</span>
					{#if data.currentPage < data.totalPages}
						<a
							href={`${listUrl}?page=${data.currentPage + 1}`}
							class="text-base-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
						>
							next
						</a>
					{/if}
				</nav>
			{/if}
		{:else}
			<p class="mt-10 text-sm text-base-500">No movies or shows in this list yet.</p>
		{/if}
	</Container>
</main>
