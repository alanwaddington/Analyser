<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { activities, lastMode } from '$lib/stores/session';
	import FileList from '$lib/components/ui/FileList.svelte';
	import DropZone from '$lib/components/ui/DropZone.svelte';
	import XAxisToggle from '$lib/components/ui/XAxisToggle.svelte';
	import SmoothingSlider from '$lib/components/ui/SmoothingSlider.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	let {
		compareDisabled = false,
		open = false,
		onclose,
	}: {
		compareDisabled?: boolean;
		/** Whether the drawer is open (mobile only — ignored on desktop). */
		open?: boolean;
		/** Called when a nav item is tapped or Escape is pressed on mobile. */
		onclose?: () => void;
	} = $props();

	const isCompare = $derived(page.url.pathname.startsWith('/compare'));
	const isEvent = $derived(page.url.pathname.startsWith('/event'));

	function goToCompare() {
		onclose?.();
		lastMode.set('compare');
		goto('/compare');
	}

	function goToEvent() {
		onclose?.();
		lastMode.set('event');
		goto('/event');
	}
</script>

<nav class="sidebar" class:open={open}>
	<div class="logo">
		<span class="wordmark">Analyser</span>
		<span class="tagline">FIT file analysis</span>
	</div>

	<div class="mode-nav">
		<button
			class="nav-btn"
			class:active-compare={isCompare && !compareDisabled}
			class:nav-btn--disabled={compareDisabled}
			aria-disabled={compareDisabled ? 'true' : undefined}
			title={compareDisabled
				? 'Activities are from different sessions — use Event Comparison'
				: undefined}
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
				<!-- Device comparison: multi-file — append additional files -->
				<DropZone compact={true} />
			{/if}
		</div>
	{/if}

	<div class="footer">
		<XAxisToggle eventMode={isEvent} />
		<ThemeToggle />
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

	.nav-btn--disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.nav-btn--disabled:hover {
		background: transparent;
		color: var(--color-muted);
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

	/* ── Mobile: drawer overlay at ≤768px ─────────────────────────────── */

	@media (max-width: 768px) {
		.sidebar {
			position: fixed;
			top: 0;
			left: 0;
			width: 280px;
			height: 100vh;
			z-index: 100;
			transform: translateX(-100%);
			transition: transform 0.3s ease;
			box-shadow: none;
		}

		.sidebar.open {
			transform: translateX(0);
			box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
		}
	}
</style>
