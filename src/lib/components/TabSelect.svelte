<script lang="ts" generics="Value extends string">
	import { ToggleGroup, ToggleGroupItem } from '@atmo-dev/kit';

	let {
		value = $bindable(),
		options,
		label = 'Choose view'
	}: {
		value: Value;
		options: Array<{ value: Value; label: string }>;
		label?: string;
	} = $props();
</script>

<ToggleGroup
	bind:value={
		() => value,
		(next) => {
			// A view selector always keeps one option selected.
			if (options.some((option) => option.value === next)) value = next as Value;
		}
	}
	aria-label={label}
	class="p-0.5"
>
	{#each options as option (option.value)}
		<ToggleGroupItem value={option.value}>{option.label}</ToggleGroupItem>
	{/each}
</ToggleGroup>
