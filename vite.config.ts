import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		// Ensure Svelte uses its browser-compatible build when running component
		// tests.  Without 'browser' in conditions, Svelte 5 resolves to
		// index-server.js which throws "mount(...) is not available on the server".
		// All existing tests (pure utility functions) are unaffected by this change
		// because they never import Svelte components directly.
		conditions: ['browser'],
	},
	test: {
		include: ['src/**/*.test.ts'],
		// Default environment for pure utility tests.
		// Component tests (*.component.test.ts) override this per-file with the
		// `// @vitest-environment jsdom` directive at the top of each file.
		environment: 'node',
	},
});
