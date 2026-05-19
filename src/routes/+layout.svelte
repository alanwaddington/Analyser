<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { lastMode } from '$lib/stores/session';
	import Sidebar from '$lib/components/ui/Sidebar.svelte';

	let { children } = $props();

	$effect(() => {
		const path = page.url.pathname;
		if (path.startsWith('/compare')) lastMode.set('compare');
		else if (path.startsWith('/event')) lastMode.set('event');
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="shell">
	<Sidebar />
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
