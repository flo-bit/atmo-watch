import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { searchForWorkspaceRoot } from 'vite';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { sveltekitOG } from '@ethercorps/sveltekit-og/plugin';

// Follow the installed package in both registry and explicit kit:local mode.
const kitRoot = dirname(dirname(createRequire(import.meta.url).resolve('@atmo-dev/kit/theme.css')));

export default defineConfig({
	resolve: { dedupe: ['svelte', 'bits-ui'] },
	// Kit contains Svelte source. Keep its exports live when patches or local builds change.
	optimizeDeps: { exclude: ['@atmo-dev/kit'] },
	server: {
		host: '127.0.0.1',
		fs: { allow: [searchForWorkspaceRoot(process.cwd()), kitRoot] }
	},
	// Add Workerd to Vite's default SSR conditions so packages can select their Worker-safe exports.
	ssr: {
		resolve: { conditions: ['workerd', 'module', 'node', 'development|production'] }
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter(),

			experimental: {
				remoteFunctions: true
			}
		}),
		sveltekitOG()
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					// Start Chromium after server tests, not alongside their cold module transforms.
					sequence: { groupOrder: 1 },
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
