<script lang="ts">
	import { browser } from '$app/environment';
	import { renderSVG } from 'uqr';
	import {
		syncStatus,
		pushLabels,
		resolveCode,
		adoptSyncIdentity,
		resetSyncIdentity,
	} from '$lib/stores/sync';
	import { SHORT_CODE_REGEX } from '$lib/validation';

	// ---------------------------------------------------------------------------
	// Local state
	// ---------------------------------------------------------------------------

	let isOpen      = $state(false);
	let codeInput   = $state('');
	let codeError   = $state<string | null>(null);
	let codeSuccess = $state(false);
	let isResolving = $state(false);
	let copied      = $state(false);

	// ---------------------------------------------------------------------------
	// Derived values
	// ---------------------------------------------------------------------------

	/** Sync URL used for QR code and copy-link. */
	const syncUrl = $derived(
		browser && $syncStatus.uuid
			? `${window.location.origin}?sync=${$syncStatus.uuid}`
			: '',
	);

	/** QR code SVG — generated client-side via uqr (no server round-trip). */
	const qrSvg = $derived(syncUrl ? renderSVG(syncUrl) : '');

	/** Whether the ☁ badge should appear (UUID not yet set up — should be rare). */
	const showBadge = $derived(!$syncStatus.uuid && !$syncStatus.error);

	/** Human-readable last-synced time. */
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

	// ---------------------------------------------------------------------------
	// Actions
	// ---------------------------------------------------------------------------

	function toggle() {
		isOpen = !isOpen;
		if (!isOpen) {
			codeError = null;
			codeSuccess = false;
			codeInput = '';
		}
	}

	async function copyLink(): Promise<void> {
		if (!syncUrl || !browser) return;
		try {
			await navigator.clipboard.writeText(syncUrl);
			copied = true;
			setTimeout(() => { copied = false; }, 2000);
		} catch {
			// Clipboard unavailable (HTTP, permissions) — silent fallback
		}
	}

	async function submitCode(): Promise<void> {
		const trimmed = codeInput.trim().toUpperCase();
		if (!trimmed) return;

		// Client-side format validation — gives a clear message before hitting the server
		if (!SHORT_CODE_REGEX.test(trimmed)) {
			codeError = 'Code must be in XXX-XXXXX format (e.g. E6Y-NXEMF)';
			return;
		}

		codeError = null;
		codeSuccess = false;
		isResolving = true;
		try {
			const uuid = await resolveCode(trimmed);
			await adoptSyncIdentity(uuid);
			codeInput = '';
			codeSuccess = true;
			setTimeout(() => { codeSuccess = false; }, 2000);
		} catch (err) {
			codeError = err instanceof Error ? err.message : 'Failed to resolve code';
		} finally {
			isResolving = false;
		}
	}

	async function retrySync(): Promise<void> {
		const uuid = $syncStatus.uuid;
		const shortCode = $syncStatus.shortCode;
		if (uuid && shortCode) {
			await pushLabels(uuid, shortCode);
		}
	}

	async function handleReset(): Promise<void> {
		if (!browser) return;
		if (!window.confirm('Generate a new sync identity? Your current sync ring will be abandoned.')) return;
		await resetSyncIdentity();
	}

	function onCodeKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') submitCode();
	}
</script>

<!-- ─────────────────────────────────────────────────────────────────────────
     Expanded panel content (rendered above the toggle row via DOM order)
     ───────────────────────────────────────────────────────────────────────── -->
{#if isOpen}
	<div class="sync-panel">
		<!-- Status line -->
		{#if $syncStatus.error}
			<p class="status error">
				⚠ Sync error —
				<button class="link-btn" onclick={retrySync}>retry</button>
			</p>
		{:else if $syncStatus.lastSynced}
			<p class="status ok">☁ Syncing across devices ✓ · {formatAge($syncStatus.lastSynced)}</p>
		{:else}
			<p class="status muted">Setting up sync…</p>
		{/if}

		<!-- QR code (browser-only) -->
		{#if browser && qrSvg}
			<div class="qr-wrapper" aria-label="Scan to link this device">
				{@html qrSvg}
			</div>
		{/if}

		<!-- Short code display -->
		{#if $syncStatus.shortCode}
			<div class="shortcode" title="Short sync code">{$syncStatus.shortCode}</div>
		{/if}

		<!-- Copy link button -->
		<button class="copy-btn" onclick={copyLink} disabled={!syncUrl}>
			{#if copied}✓ Copied!{:else}📋 Copy link{/if}
		</button>

		<div class="divider"></div>

		<!-- Code entry -->
		<span class="section-label">Link another device</span>
		<div class="code-row">
			<input
				class="code-input"
				type="text"
				bind:value={codeInput}
				onkeydown={onCodeKeydown}
				placeholder="E.g. E6Y-NXEMF"
				maxlength="9"
				aria-label="Enter sync code"
				disabled={isResolving}
			/>
			<button
				class="code-submit"
				onclick={submitCode}
				disabled={!codeInput.trim() || isResolving}
				aria-label="Submit code"
			>→</button>
		</div>
		{#if codeSuccess}
			<p class="code-success">✓ Linked! Labels synced.</p>
		{:else if codeError}
			<p class="code-error">{codeError}</p>
		{/if}

		<!-- Reset -->
		<button class="reset-btn" onclick={handleReset}>Reset sync identity</button>
	</div>
{/if}

<!-- ─────────────────────────────────────────────────────────────────────────
     Toggle row — always visible in the sidebar footer
     ───────────────────────────────────────────────────────────────────────── -->
<button class="toggle-row" onclick={toggle} aria-expanded={isOpen} aria-label="Toggle sync panel">
	<span class="toggle-icon-wrap">
		<span class="toggle-icon" aria-hidden="true">☁</span>
		{#if showBadge}
			<span class="badge" aria-hidden="true"></span>
		{/if}
	</span>
	<span class="toggle-label">Sync</span>
	<span class="toggle-chevron" class:open={isOpen} aria-hidden="true">▾</span>
</button>

<style>
	/* ── Toggle row ──────────────────────────────────────────────────────────── */

	.toggle-row {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 3px 0;
		border: none;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.75rem;
		cursor: pointer;
		text-align: left;
		border-radius: 4px;
		transition: color 0.1s;
	}

	.toggle-row:hover {
		color: var(--color-text);
	}

	.toggle-row:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.toggle-icon-wrap {
		position: relative;
		flex-shrink: 0;
		font-size: 0.85rem;
		line-height: 1;
	}

	.badge {
		position: absolute;
		top: -2px;
		right: -3px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #3b82f6;
		border: 1px solid var(--color-sidebar);
	}

	.toggle-label {
		flex: 1;
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.toggle-row:hover .toggle-label {
		color: var(--color-text);
	}

	.toggle-chevron {
		font-size: 0.65rem;
		color: var(--color-muted);
		transition: transform 0.2s;
	}

	.toggle-chevron.open {
		transform: rotate(180deg);
	}

	/* ── Expanded panel ──────────────────────────────────────────────────────── */

	.sync-panel {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 0 8px;
		border-top: 1px solid var(--color-border);
		margin-bottom: 4px;
	}

	/* Status line */
	.status {
		margin: 0;
		font-size: 0.7rem;
		line-height: 1.3;
	}

	.status.ok     { color: #4ade80; }
	.status.error  { color: #f59e0b; }
	.status.muted  { color: var(--color-muted); }

	:global([data-theme="light"]) .status.ok { color: #16a34a; }

	/* QR code */
	.qr-wrapper {
		display: flex;
		justify-content: center;
		background: #ffffff;
		border-radius: 4px;
		padding: 6px;
		overflow: hidden;
	}

	.qr-wrapper :global(svg) {
		width: 130px;
		height: 130px;
		display: block;
	}

	/* Short code */
	.shortcode {
		text-align: center;
		font-family: 'Courier New', Courier, monospace;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--color-text);
		padding: 4px 0;
	}

	/* Copy link button */
	.copy-btn {
		width: 100%;
		padding: 5px 10px;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: transparent;
		color: var(--color-text);
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.1s, border-color 0.1s;
	}

	.copy-btn:hover:not(:disabled) {
		background: rgba(59, 130, 246, 0.1);
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.copy-btn:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.copy-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Divider */
	.divider {
		height: 1px;
		background: var(--color-border);
		margin: 2px 0;
	}

	/* Section label */
	.section-label {
		font-size: 0.7rem;
		color: var(--color-muted);
	}

	/* Code entry row */
	.code-row {
		display: flex;
		gap: 4px;
	}

	.code-input {
		flex: 1;
		min-width: 0;
		padding: 4px 8px;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-bg);
		color: var(--color-text);
		font-size: 0.7rem;
		font-family: 'Courier New', Courier, monospace;
		letter-spacing: 0.04em;
		outline: none;
		transition: border-color 0.1s;
	}

	.code-input::placeholder {
		color: var(--color-muted);
		font-family: inherit;
		letter-spacing: 0;
	}

	.code-input:focus {
		border-color: #3b82f6;
	}

	.code-input:disabled {
		opacity: 0.5;
	}

	.code-submit {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.85rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.1s, border-color 0.1s, color 0.1s;
	}

	.code-submit:hover:not(:disabled) {
		background: #3b82f6;
		border-color: #3b82f6;
		color: #fff;
	}

	.code-submit:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.code-submit:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Code feedback */
	.code-error {
		margin: 0;
		font-size: 0.7rem;
		color: #f59e0b;
	}

	.code-success {
		margin: 0;
		font-size: 0.7rem;
		color: #4ade80;
	}

	:global([data-theme="light"]) .code-success {
		color: #16a34a;
	}

	/* Reset link */
	.reset-btn {
		border: none;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.68rem;
		cursor: pointer;
		padding: 0;
		text-align: left;
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: color 0.1s;
	}

	.reset-btn:hover {
		color: #f59e0b;
	}

	.reset-btn:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	/* ── Link button (inline) ─────────────────────────────────────────────── */

	.link-btn {
		border: none;
		background: transparent;
		color: inherit;
		font-size: inherit;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>
