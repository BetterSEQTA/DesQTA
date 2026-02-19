// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Exclude layerchart's .svelte.js files - they contain Svelte 5 runes that our
	// layerchartRunesPlugin compiles. Without this, the Svelte plugin would re-process
	// our compiled output and fail on the internal $ import.
	vitePlugin: {
		exclude: ['**/node_modules/layerchart/**/*.svelte.js', '**/layerchart/**/*.svelte.js'],
		experimental: {
			compileModule: {
				exclude: ['**/node_modules/layerchart/**/*.svelte.js', '**/layerchart/**/*.svelte.js'],
			},
		},
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		// Optimize for single-page app
		prerender: {
			handleHttpError: 'warn',
			handleUnseenRoutes: 'ignore'
		}
	},
	preprocess: vitePreprocess()
};

export default config;
