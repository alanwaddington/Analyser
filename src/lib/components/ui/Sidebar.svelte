<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { activities, lastMode, clearActivities } from '$lib/stores/session';
	import FileList from '$lib/components/ui/FileList.svelte';
	import DropZone from '$lib/components/ui/DropZone.svelte';
	import XAxisToggle from '$lib/components/ui/XAxisToggle.svelte';
	import SmoothingSlider from '$lib/components/ui/SmoothingSlider.svelte';

	const isCompare = $derived(page.url.pathname.startsWith('/compare'));
	const isEvent = $derived(page.url.pathname.startsWith('/event'));

	function goToCompare() {
		// Device comparison is single-file — clear before navigating so stale
		// multi-file event data doesn't carry over
		clearActivities();
		lastMode.set('compare');
		goto('/compare');
	}

	function goToEvent() {
		lastMode.set('event');
		goto('/event');
	}
</script>

<nav class="sidebar">
	<div class="logo">
		<span class="wordmark">Analyser</span>
		<span class="tagline">FIT file analysis</span>
	</div>

	<div class="mode-nav">
		<button
			class="nav-btn"
			class:active-compare={isCompare}
			onclick={goToCompare}
		>⚡ Device Comparison</button>
		<button
			class="nav-btn"
			class:active-event={isEvent}
			onclick={goToEvent}
		>🏃 Event Comparison</button>
	</div>

	{#if $activities.length > 0}
		<div class="file-section">
			<FileList mode={isEvent ? 'event' : 'compare'} />
			{#if isEvent}
				<!-- Event mode: allow multiple files -->
				<DropZone compact={true} />
			{:else if isCompare}
				<!-- Device comparison: single-file — show replace drop zone -->
				<DropZone compact={true} singleFile={true} />
			{/if}
		</div>
	{/if}

	<div class="footer">
		<XAxisToggle eventMode={isEvent} />
		<SmoothingSlider />
	</div>
</nav>

<style>
	.sidebar {
		width: 210px;
		height: 100vh;
		background: var(--color-sidebar);
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		overflow: hidden;
	}

	.logo {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 20px 16px 16px;
		border-bottom: 1px solid var(--color-border);
	}

	.wordmark {
		font-size: 1.1rem;
		font-weight: 700;
		color: #3b82f6;
		letter-spacing: -0.02em;
	}

	.tagline {
		font-size: 0.7rem;
		color: var(--color-muted);
	}

	.mode-nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px;
		border-bottom: 1px solid var(--color-border);
	}

	.nav-btn {
		width: 100%;
		padding: 7px 10px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}

	.nav-btn:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--color-text);
	}

	.nav-btn.active-compare {
		background: #1e3a5f;
		color: #60a5fa;
	}

	.nav-btn.active-event {
		background: #14532d;
		color: #4ade80;
	}

	.file-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		overflow-y: auto;
		border-bottom: 1px solid var(--color-border);
		min-height: 0;
	}

	.footer {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		margin-top: auto;
	}
</style>
