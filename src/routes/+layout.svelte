<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { activities, lastMode } from '$lib/stores/session';
	import { activitiesOverlap } from '$lib/align';
	import { themePreference, isDark, initTheme } from '$lib/stores/theme';
	import Sidebar from '$lib/components/ui/Sidebar.svelte';

	let { children } = $props();

	// Disable Device Comparison when 2+ files are loaded from different sessions.
	const compareDisabled = $derived(!activitiesOverlap($activities));

	onMount(() => {
		initTheme();
	});

	// Sync data-theme attribute on <html> whenever the resolved theme changes.
	$effect(() => {
		if (browser) {
			document.documentElement.dataset.theme = $isDark ? 'dark' : 'light';
		}
	});

	$effect(() => {
		const path = page.url.pathname;
		if (path.startsWith('/compare')) lastMode.set('compare');
		else if (path.startsWith('/event')) lastMode.set('event');
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="shell">
	<Sidebar {compareDisabled} />
	<main class="main-area">
		{@render children()}
	</main>
</div>

<style>
	.shell {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}

	.main-area {
		flex: 1;
		overflow-y: auto;
		background: var(--color-bg);
	}
</style>
