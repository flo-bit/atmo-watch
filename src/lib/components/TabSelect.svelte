<script lang="ts" generics="Value extends string">
	let {
		value = $bindable(),
		options,
		label = 'Choose view'
	}: {
		value: Value;
		options: Array<{ value: Value; label: string }>;
		label?: string;
	} = $props();

	let selectedIndex = $derived(
		Math.max(
			0,
			options.findIndex((option) => option.value === value)
		)
	);
</script>

<div
	class="relative inline-grid rounded-full p-0.5 ring-1 ring-white/6"
	style:grid-template-columns={`repeat(${options.length}, minmax(0, 1fr))`}
	role="group"
	aria-label={label}
>
	<span
		class="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-white/[0.08] transition-transform duration-200 ease-out motion-reduce:transition-none"
		style:width={`calc((100% - 0.25rem) / ${Math.max(1, options.length)})`}
		style:transform={`translateX(${selectedIndex * 100}%)`}
		aria-hidden="true"
	></span>

	{#each options as option (option.value)}
		<button
			type="button"
			onclick={() => (value = option.value)}
			aria-pressed={value === option.value}
			class={`relative z-10 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 ${
				value === option.value ? 'text-base-100' : 'text-base-500 hover:text-base-300'
			}`}
		>
			{option.label}
		</button>
	{/each}
</div>
