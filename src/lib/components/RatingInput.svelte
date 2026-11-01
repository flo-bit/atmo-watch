<script lang="ts">
	import { Icon } from '@atmo-dev/kit';
	import { Star } from '@sketchyicons/svelte';
	let {
		value = $bindable(0),
		onchange = () => {}
	}: {
		value?: number;
		onchange?: (value: number) => void;
	} = $props();

	const uid = $props.id();
	let hoverValue = $derived(value);

	function select(score: number) {
		value = score;
		hoverValue = score;
		onchange(score);
	}

	function scoreLabel(score: number) {
		const stars = score / 2;
		return `${stars} out of 5 stars`;
	}
</script>

<fieldset class="w-fit" onmouseleave={() => (hoverValue = value)}>
	<legend class="sr-only">Your rating</legend>

	<div class="flex items-center" role="radiogroup" aria-label="Your rating">
		{#each [1, 2, 3, 4, 5] as star (star)}
			{@const fullScore = star * 2}
			{@const fill = hoverValue >= fullScore ? 100 : hoverValue === fullScore - 1 ? 50 : 0}
			<span class="rating-star relative block size-9 shrink-0 rounded-sm">
				<Icon img={Star} class="size-full text-base-700 [&_path]:fill-current" />

				{#if fill > 0}
					<span
						class="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
						style:width={`${fill}%`}
					>
						<Icon img={Star} class="size-9 max-w-none text-accent-500 [&_path]:fill-current" />
					</span>
				{/if}

				{#each [fullScore - 1, fullScore] as score (score)}
					<input
						type="radio"
						name={`rating-${uid}`}
						value={score}
						checked={value === score}
						onchange={() => select(score)}
						onmouseenter={() => (hoverValue = score)}
						class={`absolute inset-y-0 z-10 m-0 h-full w-1/2 cursor-pointer appearance-none border-0 bg-transparent p-0 opacity-0 focus:ring-0 ${score % 2 === 1 ? 'left-0' : 'right-0'}`}
						aria-label={scoreLabel(score)}
					/>
				{/each}
			</span>
		{/each}
	</div>
</fieldset>

<style>
	.rating-star:has(input:focus-visible) {
		outline: 2px solid rgb(255 255 255 / 0.7);
		outline-offset: 1px;
	}
</style>
