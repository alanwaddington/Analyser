<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { activities, lastMode } from '$lib/stores/session';
	import { activitiesOverlap } from '$lib/align';
	import { isDark, initTheme } from '$lib/stores/theme';
	import { viewport } from '$lib/stores/viewport';
	import Sidebar from '$lib/components/ui/Sidebar.svelte';

	let { children } = $props();

	// Disable Device Comparison when 2+ files are loaded from different sessions.
	const compareDisabled = $derived(!activitiesOverlap($activities));

	// Viewport tier — drives hamburger visibility and bottom nav.
	const isMobile = $derived($viewport !== 'desktop');
	const isPhone  = $derived($viewport === 'phone');

	// Current page for bottom nav active state.
	const isCompare = $derived(page.url.pathname.startsWith('/compare'));
	const isEvent   = $derived(page.url.pathname.startsWith('/event'));

	// Drawer open/close state (mobile only).
	let sidebarOpen = $state(false);

	function openSidebar()  { sidebarOpen = true; }
	function closeSidebar() { sidebarOpen = false; }

	// Close drawer when resizing back to desktop.
	$effect(() => {
		if ($viewport === 'desktop') sidebarOpen = false;
	});

	// Prevent body scroll while drawer is open.
	$effect(() => {
		if (browser) {
			document.body.style.overflow = (sidebarOpen && isMobile) ? 'hidden' : '';
		}
	});

	// Escape key closes the drawer.
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && sidebarOpen) closeSidebar();
	}

	// Swipe-to-close: track horizontal touch delta on backdrop / drawer.
	let touchStartX = 0;
	function onTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
	}
	function onTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		if (dx < -80) closeSidebar();
	}

	// Bottom nav navigation (also closes drawer if open).
	function goToCompare() {
		sidebarOpen = false;
		lastMode.set('compare');
		goto('/compare');
	}
	function goToEvent() {
		sidebarOpen = false;
		lastMode.set('event');
		goto('/event');
	}

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

<svelte:window onkeydown={onKeydown} />
<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="shell">
	{#if isMobile}
		<!-- Hamburger button — replaces fixed sidebar at ≤768px -->
		<button
			class="hamburger-btn"
			onclick={() => sidebarOpen = !sidebarOpen}
			aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
			aria-expanded={sidebarOpen}
		>
			<span class="hamburger-icon" aria-hidden="true"></span>
			{#if $activities.length > 0}
				<span class="hamburger-badge" aria-hidden="true"></span>
			{/if}
		</button>

		<!-- Backdrop — tap or swipe left to close -->
		<div
			class="backdrop"
			class:backdrop--visible={sidebarOpen}
			role="presentation"
			onclick={closeSidebar}
			ontouchstart={onTouchStart}
			ontouchend={onTouchEnd}
		></div>
	{/if}

	<Sidebar
		{compareDisabled}
		open={sidebarOpen}
		onclose={closeSidebar}
	/>

	<main class="main-area">
		{@render children()}
	</main>

	<!-- Bottom navigation bar — phone only (≤480px) -->
	{#if isPhone}
		<nav class="bottom-nav" aria-label="Primary navigation">
			<button
				class="bottom-nav-btn"
				class:active-compare={isCompare && !compareDisabled}
				class:nav-btn--disabled={compareDisabled}
				aria-disabled={compareDisabled ? 'true' : undefined}
				aria-current={isCompare && !compareDisabled ? 'page' : undefined}
				title={compareDisabled
					? 'Activities are from different sessions — use Event Comparison'
					: undefined}
				onclick={goToCompare}
			>
				<span class="nav-icon" aria-hidden="true">⚡</span>
				<span>Device</span>
			</button>
			<button
				class="bottom-nav-btn"
				class:active-event={isEvent}
				aria-current={isEvent ? 'page' : undefined}
				onclick={goToEvent}
			>
				<span class="nav-icon" aria-hidden="true">🏃</span>
				<span>Event</span>
			</button>
		</nav>
	{/if}
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

	/* ── Hamburger button ─────────────────────────────────────────────── */

	.hamburger-btn {
		display: none;  /* shown only at ≤768px via media query */
		position: fixed;
		top: 0;
		left: 0;
		width: 44px;
		height: 44px;
		z-index: 110;
		background: var(--color-sidebar);
		border: none;
		border-right: 1px solid var(--color-border);
		border-bottom: 1px solid var(--color-border);
		border-radius: 0 0 6px 0;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}

	.hamburger-btn:hover {
		background: color-mix(in srgb, var(--color-sidebar) 85%, var(--color-text));
	}

	.hamburger-btn:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.hamburger-icon {
		display: block;
		width: 18px;
		height: 2px;
		background: var(--color-text);
		border-radius: 1px;
		box-shadow: 0 5px 0 var(--color-text), 0 10px 0 var(--color-text);
		margin: auto;
		position: relative;
		top: -4px; /* vertically centre the 3 lines within the button */
	}

	/* Files-loaded badge */
	.hamburger-badge {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #3b82f6;
		border: 1.5px solid var(--color-sidebar);
	}

	/* ── Backdrop ─────────────────────────────────────────────────────── */

	.backdrop {
		display: none;  /* shown via media query + class */
		position: fixed;
		inset: 0;
		z-index: 99;
		background: rgba(0, 0, 0, 0.5);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.3s ease;
	}

	.backdrop--visible {
		opacity: 1;
		pointer-events: auto;
	}

	:global([data-theme="light"]) .backdrop {
		background: rgba(0, 0, 0, 0.3);
	}

	/* ── Bottom navigation bar (phone ≤480px) ─────────────────────────── */

	.bottom-nav {
		display: none; /* shown via media query */
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 90;
		height: 56px;
		background: var(--color-sidebar);
		border-top: 1px solid var(--color-border);
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}

	.bottom-nav-btn {
		flex: 1;
		height: 56px;
		border: none;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		transition: color 0.15s, background 0.15s;
		position: relative;
	}

	.bottom-nav-btn:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	:global([data-theme="light"]) .bottom-nav-btn:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.bottom-nav-btn:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: -2px;
	}

	.bottom-nav-btn.active-compare { color: #3b82f6; }
	.bottom-nav-btn.active-event   { color: #22c55e; }

	/* Active indicator bar at top of button */
	.bottom-nav-btn.active-compare::before,
	.bottom-nav-btn.active-event::before {
		content: '';
		position: absolute;
		top: 0;
		left: 16px;
		right: 16px;
		height: 2px;
		border-radius: 0 0 2px 2px;
	}
	.bottom-nav-btn.active-compare::before { background: #3b82f6; }
	.bottom-nav-btn.active-event::before   { background: #22c55e; }

	.bottom-nav-btn.nav-btn--disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.nav-icon {
		font-size: 1.1rem;
		line-height: 1;
	}

	/* ── Responsive overrides ─────────────────────────────────────────── */
	/* breakpoints: --bp-tablet (768px) / --bp-phone (480px) in layout.css */

	@media (max-width: 768px) { /* --bp-tablet */
		.shell {
			overflow: visible; /* allow fixed-position drawer to overlay */
		}

		.main-area {
			padding-top: 44px; /* clear hamburger button */
		}

		.hamburger-btn {
			display: flex;
		}

		.backdrop {
			display: block;
		}
	}

	@media (max-width: 480px) { /* --bp-phone */
		.main-area {
			padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
		}

		.bottom-nav {
			display: flex;
		}
	}
</style>
