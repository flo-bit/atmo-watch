<script lang="ts">
	import { LegalFooter } from '@atmo-dev/kit';
	import { legalFooterLinks } from '$lib/legal';
	import tmdbIcon from '$lib/icons/tmdb.svg';
</script>

<div class="relative z-10 border-t border-white/10 px-4 pt-8 md:pl-20">
	<div class="flex flex-col items-center gap-3 text-center text-xs text-base-400">
		<a
			href="https://www.themoviedb.org/"
			target="_blank"
			rel="noopener noreferrer"
			aria-label="The Movie Database"
		>
			<img src={tmdbIcon} alt="" class="h-5 w-auto" />
		</a>
		<p>
			This website uses the TMDB API but is not endorsed or certified by TMDB. Streaming
			availability provided by <a
				href="https://www.justwatch.com/"
				target="_blank"
				rel="noopener noreferrer"
				class="underline decoration-current/40 underline-offset-2 hover:text-white">JustWatch</a
			>.
		</p>
	</div>
	<LegalFooter links={legalFooterLinks} />
</div>
