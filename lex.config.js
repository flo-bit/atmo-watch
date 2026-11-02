import { defineLexiconConfig } from '@atcute/lex-cli';

export default defineLexiconConfig({
	generate: {
		files: [
			'lexicons/custom/**/*.json',
			'lexicons/pulled/**/*.json',
			'lexicons/generated/**/*.json'
		],
		outdir: 'src/lib/contrail/types/'
	}
});
