<script lang="ts">
	import { Avatar } from '@atmo-dev/kit';

	let {
		src,
		alt = '',
		shape = 'circle',
		class: className = 'size-11'
	}: {
		src?: string;
		alt?: string;
		shape?: 'circle' | 'rounded';
		class?: string;
	} = $props();
</script>

<Avatar
	{src}
	name={alt}
	class={`${shape === 'rounded' ? 'relative h-auto rounded-ui [&>img]:absolute [&>img]:inset-0' : ''} ${className}`}
/>
