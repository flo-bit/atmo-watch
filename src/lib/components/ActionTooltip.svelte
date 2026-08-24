<script lang="ts">
	let { label }: { label: string } = $props();
</script>

<span
	aria-hidden="true"
	class="pointer-events-none invisible absolute bottom-full left-1/2 z-40 mb-2 hidden -translate-x-1/2 rounded-md border border-white/10 bg-base-950/95 px-2.5 py-1.5 text-xs leading-none font-medium whitespace-nowrap text-white opacity-0 shadow-lg shadow-black/30 backdrop-blur-md transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 lg:block"
>
	{label}
</span>
