<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { activities, lastMode } from '$lib/stores/session';
	import { syncStatus } from '$lib/stores/sync';
	import FileList from '$lib/components/ui/FileList.svelte';
	import DropZone from '$lib/components/ui/DropZone.svelte';
	import XAxisToggle from '$lib/components/ui/XAxisToggle.svelte';
	import SmoothingSlider from '$lib/components/ui/SmoothingSlider.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import SyncPanel from '$lib/components/ui/SyncPanel.svelte';

	function formatAge(ts: string | null): string {
		if (!ts) return '';
		const diff = Date.now() - new Date(ts).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins} min ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return new Date(ts).toLocaleDateString();
	}

	const indicatorState = $derived((): 'syncing' | 'error' | 'ok' | 'muted' => {
		if ($syncStatus.syncing)    return 'syncing';
		if ($syncStatus.error)      return 'error';
		if ($syncStatus.lastSynced) return 'ok';
		return 'muted';
	});

	const statusText = $derived((): string => {
		if ($syncStatus.syncing)    return 'Syncing…';
		if ($syncStatus.error)      return 'Sync error';
		if ($syncStatus.lastSynced) return 'Synced';
		return 'Setting up…';
	});

	const ariaLabel = $derived((): string => {
		if ($syncStatus.syncing)    return 'Sync in progress';
		if ($syncStatus.error)      return `Sync error: ${$syncStatus.error}`;
		if ($syncStatus.lastSynced) return `Synced ${formatAge($syncStatus.lastSynced)}`;
		return 'Sync setting up';
	});

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
		<div
			class="sync-indicator sync-indicator--{indicatorState()}"
			aria-live="polite"
			aria-label={ariaLabel()}
		>
			<span class="sync-indicator__icon" class:sync-indicator__icon--spinning={$syncStatus.syncing} aria-hidden="true">
				{#if $syncStatus.syncing}
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
						<path d="M14 8a6 6 0 0 1-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
					</svg>
				{:else if $syncStatus.error}
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<path d="M8 2L14 13H2L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
						<line x1="8" y1="6" x2="8" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						<circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
					</svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<circle cx="8" cy="8" r="4" fill="currentColor"/>
					</svg>
				{/if}
			</span>
			<span class="sync-indicator__text">{statusText()}</span>
		</div>
		<SyncPanel />
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

	/* ── Sync indicator ─────────────────────────────────────────────────── */

	.sync-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 0;
		min-height: 28px;
	}

	.sync-indicator__icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sync-indicator__icon--spinning {
		animation: sync-spin 1s linear infinite;
	}

	.sync-indicator__text {
		font-size: 0.7rem;
		line-height: 1;
		white-space: nowrap;
	}

	.sync-indicator--ok .sync-indicator__icon  { color: #10b981; }
	.sync-indicator--ok .sync-indicator__text  { color: var(--color-muted); }

	.sync-indicator--syncing .sync-indicator__icon { color: #3b82f6; }
	.sync-indicator--syncing .sync-indicator__text { color: #3b82f6; }

	.sync-indicator--error .sync-indicator__icon { color: #fbbf24; }
	.sync-indicator--error .sync-indicator__text { color: #fbbf24; }

	.sync-indicator--muted .sync-indicator__icon { color: var(--color-muted); }
	.sync-indicator--muted .sync-indicator__text { color: var(--color-muted); }

	:global([data-theme="light"]) .sync-indicator--ok .sync-indicator__icon { color: #16a34a; }

	@keyframes sync-spin {
		from { transform: rotate(0deg); }
		to   { transform: rotate(360deg); }
	}

	/* ── Mobile: drawer overlay at ≤768px ─────────────────────────────── */
	/* breakpoints: --bp-tablet (768px) in layout.css */

	@media (max-width: 768px) { /* --bp-tablet */
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

		.nav-btn {
			min-height: 44px; /* WCAG 2.5.8 touch target */
		}
	}
</style>
