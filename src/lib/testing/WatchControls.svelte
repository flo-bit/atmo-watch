<script lang="ts">
	import { Button, Input, Modal } from '@atmo-dev/kit';
	import Avatar from '../components/Avatar.svelte';
	import MenuItem from '../components/MenuItem.svelte';
	import RatingInput from '../components/RatingInput.svelte';
	import TabSelect from '../components/TabSelect.svelte';

	let view = $state('movies');
	let rating = $state(0);
	let open = $state(false);
	const portrait = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="80" height="120" fill="gray"/></svg>')}`;
</script>

<section class="atmo zinc fuchsia dark" data-testid="watch-theme">
	<Avatar alt="Viewer" class="size-7" />
	<Avatar src={portrait} alt="Cast member" shape="rounded" class="aspect-4/5 w-24" />
	<TabSelect
		bind:value={view}
		options={[
			{ value: 'movies', label: 'Movies' },
			{ value: 'tv', label: 'TV shows' }
		]}
	/>
	<output aria-label="Selected view">{view}</output>
	<RatingInput bind:value={rating} />
	<output aria-label="Selected rating">{rating}</output>
	<MenuItem href="/videos" label="Videos" active>
		<span aria-hidden="true">→</span>
	</MenuItem>
	<Button onclick={() => (open = true)}>Open dialog</Button>
	<Modal bind:open title="Watch dialog">
		<Input aria-label="Title" data-autofocus />
	</Modal>
</section>
