<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title = 'Options',
		children,
	}: {
		/** Header label shown on the toggle button (mobile only). */
		title?: string;
		children: Snippet;
	} = $props();

	/** Collapsed by default on mobile; toggled by the header button. */
	let expanded = $state(false);
</script>

<div class="collapsible-panel">
	<!-- Toggle button — visible only at ≤768px via CSS -->
	<button
		class="panel-toggle"
		onclick={() => expanded = !expanded}
		aria-expanded={expanded}
		aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
	>
		<span class="panel-title">{title}</span>
		<span class="panel-chevron" class:panel-chevron--open={expanded} aria-hidden="true">▾</span>
	</button>

	<!-- Content: always visible on desktop; toggleable on mobile -->
	<div class="panel-body" class:panel-body--collapsed={!expanded}>
		{@render children()}
	</div>
</div>

<style>
	.collapsible-panel {
		display: contents; /* zero layout impact on desktop */
	}

	.panel-toggle {
		display: none; /* shown only at ≤768px */
		width: 100%;
		min-height: 44px;
		padding: 0 16px;
		background: var(--color-sidebar);
		border: none;
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex-shrink: 0;
		transition: background 0.15s;
	}

	.panel-toggle:hover {
		background: color-mix(in srgb, var(--color-sidebar) 85%, var(--color-text));
	}

	.panel-toggle:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: -2px;
	}

	.panel-title {
		flex: 1;
		text-align: left;
	}

	.panel-chevron {
		font-size: 1rem;
		line-height: 1;
		transition: transform 0.2s ease;
		display: inline-block;
		transform: rotate(0deg);
	}

	.panel-chevron--open {
		transform: rotate(180deg);
	}

	.panel-body {
		display: contents; /* zero layout impact on desktop */
	}

	/* ── Mobile: collapsible at ≤768px ──────────────────────────────── */
	/* breakpoints: --bp-tablet (768px) in layout.css */

	@media (max-width: 768px) { /* --bp-tablet */
		.collapsible-panel {
			display: flex;
			flex-direction: column;
			flex-shrink: 0;
		}

		.panel-toggle {
			display: flex;
		}

		.panel-body {
			display: flex;
			flex-direction: column;
			overflow: hidden;
			max-height: 400px;
			transition: max-height 0.25s ease, opacity 0.2s ease;
			opacity: 1;
		}

		.panel-body--collapsed {
			max-height: 0;
			opacity: 0;
			pointer-events: none;
		}
	}
</style>
