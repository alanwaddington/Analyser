import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
	plugins: [tailwindcss(), sveltekit(), visualizer({ filename: 'stats.html', open: false, gzipSize: true })],
	build: { chunkSizeWarningLimit: 1200 },
	// The 'browser' condition is required by vitest so Svelte 5 resolves to
	// its browser bundle instead of index-server.js (which throws
	// "mount(...) is not available on the server" in jsdom component tests).
	//
	// We only set resolve.conditions during test runs.  In production the key
	// is omitted entirely so Vite keeps its built-in defaults
	// (['module','browser','default'] for client bundles) — important because
	// Leaflet and tslib rely on those defaults to resolve their browser builds.
	...(mode === 'test' ? { resolve: { conditions: ['browser'] } } : {}),
	test: {
		include: ['src/**/*.test.ts'],
		// Default environment for pure utility tests.
		// Component tests (*.component.test.ts) override this per-file with the
		// `// @vitest-environment jsdom` directive at the top of each file.
		environment: 'node',
	},
}));
