<script lang="ts">
	import { untrack } from 'svelte';
	import { UserProfile } from '@foxui/social';
	import Container from '$lib/components/Container.svelte';
	import ItemCard from '$lib/components/ItemCard.svelte';
	import ListCard from '$lib/components/ListCard.svelte';
	import Review from '$lib/components/Review.svelte';
	import TabSelect from '$lib/components/TabSelect.svelte';
	import type { PageData } from './$types';

	type ProfileSection = 'reviews' | 'ratings' | 'lists';

	function getDefaultSection(data: PageData): ProfileSection {
		if (data.reviews.some((review) => review.text.trim())) return 'reviews';
		if (data.reviews.length > 0) return 'ratings';
		return 'lists';
	}

	let { data }: { data: PageData } = $props();
	let ratings = $derived(data.reviews.filter((review) => !review.text.trim()));
	let writtenReviews = $derived(data.reviews.filter((review) => review.text.trim()));
	let selectedSection = $state<ProfileSection>(untrack(() => getDefaultSection(data)));
	let profileTabs = $derived(
		[
			writtenReviews.length > 0 ? { value: 'reviews' as const, label: 'reviews' } : null,
			ratings.length > 0 ? { value: 'ratings' as const, label: 'ratings' } : null,
			data.lists.length > 0 ? { value: 'lists' as const, label: 'lists' } : null
		].filter((option): option is { value: ProfileSection; label: string } => option !== null)
	);

	$effect(() => {
		if (profileTabs.length > 0 && !profileTabs.some((tab) => tab.value === selectedSection)) {
			selectedSection = profileTabs[0].value;
		}
	});
</script>

<svelte:head>
	<title>@{data.profile.handle} | atmo.watch</title>
	<meta name="description" content={`Movie and TV reviews and lists by @${data.profile.handle}.`} />
</svelte:head>

<main class="min-h-dvh bg-base-950 pb-12 text-base-50">
	<Container class="px-4 pt-12">
		<UserProfile
			class="not-prose"
			profile={{
				handle: `@${data.profile.handle}`,
				displayName: data.profile.displayName,
				description: data.profile.description,
				avatar: data.profile.avatarUrl,
				banner: data.profile.bannerUrl
			}}
		/>

		{#if profileTabs.length > 0}
			<section class="mx-auto max-w-2xl pt-8" aria-labelledby="activity-heading">
				<h2 id="activity-heading" class="sr-only">@{data.profile.handle}'s activity</h2>
				<TabSelect
					bind:value={selectedSection}
					options={profileTabs}
					label="Choose profile section"
				/>

				{#if selectedSection === 'reviews' && writtenReviews.length > 0}
					<div class="mt-4 flex max-w-2xl flex-col gap-4">
						{#each writtenReviews as review (review.uri)}
							<Review {review} />
						{/each}
					</div>
				{:else if selectedSection === 'ratings' && ratings.length > 0}
					<div class="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-3 lg:grid-cols-5">
						{#each ratings as review (review.uri)}
							<ItemCard item={review.media} showTitle={false} rating={review.rating} />
						{/each}
					</div>
				{:else if selectedSection === 'lists' && data.lists.length > 0}
					<div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
						{#each data.lists as list (list.uri)}
							<ListCard {list} />
						{/each}
					</div>
				{/if}
			</section>
		{:else}
			<p class="mx-auto max-w-2xl pt-8 text-sm text-base-400">No reviews, ratings, or lists yet.</p>
		{/if}
	</Container>
</main>
