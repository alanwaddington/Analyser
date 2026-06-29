<script lang="ts">
	import type { LabelEdit } from '$lib/stores/deviceLabels';
	import { relativeTime } from '$lib/utils/relativeTime';

	let {
		history,
		currentLabel,
		deviceKey,
		canUndoDevice,
		onundo,
	}: {
		history: LabelEdit[];
		currentLabel: string;
		deviceKey: string | null;
		canUndoDevice: boolean;
		onundo: () => void;
	} = $props();
</script>

<div class="popover" role="tooltip" aria-label="Rename history for {currentLabel}">
	<header class="hdr">
		<span class="device-name">{currentLabel}</span>
		<span class="badge">HISTORY</span>
	</header>

	<div class="body">
		{#if history.length === 0}
			<p class="empty">No rename history</p>
		{:else}
			<ul class="log">
				{#each history as edit (edit.timestamp)}
					<li class="entry">
						<span class="ts">{relativeTime(edit.timestamp)}</span>
						<span class="trail">
							<span class="val" class:dim={!edit.from}>{edit.from || '(unset)'}</span>
							<span class="arr">→</span>
							<span class="val" class:dim={!edit.to}>{edit.to || '(removed)'}</span>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if canUndoDevice}
		<footer class="ftr">
			<button class="undo-btn" type="button" onclick={onundo}>
				↩ Undo last rename
			</button>
		</footer>
	{/if}
</div>

<style>
	.popover {
		position: absolute;
		bottom: calc(100% + 7px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 200;
		width: max-content;
		max-width: 240px;
		min-width: 160px;

		background-color: #0a1628;
		background-image:
			linear-gradient(rgba(59, 130, 246, 0.035) 1px, transparent 1px),
			linear-gradient(90deg, rgba(59, 130, 246, 0.035) 1px, transparent 1px);
		background-size: 8px 8px;

		border: 1px solid #1e2d45;
		border-radius: 6px;
		box-shadow:
			0 0 0 1px rgba(59, 130, 246, 0.07),
			0 12px 32px rgba(0, 0, 0, 0.7),
			0 3px 8px rgba(0, 0, 0, 0.5);
		overflow: hidden;

		animation: rise 0.14s cubic-bezier(0.22, 1, 0.36, 1) both;
		pointer-events: auto;
	}

	@keyframes rise {
		from { opacity: 0; transform: translateX(-50%) translateY(5px); }
		to   { opacity: 1; transform: translateX(-50%) translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.popover { animation: none; }
	}

	/* ── Header ─────────────────────────────────────────────── */

	.hdr {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 10px 5px;
		border-bottom: 1px solid #1e2d45;
	}

	.device-name {
		font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
		font-size: 0.7rem;
		font-weight: 600;
		color: #e2e8f0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.badge {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.48rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: #3b82f6;
		opacity: 0.65;
		flex-shrink: 0;
	}

	/* ── History log ─────────────────────────────────────────── */

	.body {
		padding: 4px 0;
	}

	.empty {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.62rem;
		color: #334155;
		font-style: italic;
		text-align: center;
		padding: 6px 10px;
		margin: 0;
	}

	.log {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.entry {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 4px 10px 4px 12px;
		border-left: 2px solid transparent;
		cursor: default;
		transition: border-color 0.12s, background 0.12s;
	}

	.entry:hover {
		background: rgba(59, 130, 246, 0.06);
		border-left-color: #3b82f6;
	}

	.ts {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.53rem;
		color: #334155;
		letter-spacing: 0.02em;
	}

	.trail {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.65rem;
	}

	.val {
		color: #94a3b8;
		max-width: 76px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.val.dim {
		color: #334155;
		font-style: italic;
	}

	.arr {
		color: #3b82f6;
		opacity: 0.55;
		flex-shrink: 0;
		font-size: 0.58rem;
	}

	/* ── Undo footer ─────────────────────────────────────────── */

	.ftr {
		padding: 4px 10px 6px;
		border-top: 1px solid #1e2d45;
	}

	.undo-btn {
		width: 100%;
		padding: 3px 8px;
		border-radius: 999px;
		border: 1px solid rgba(59, 130, 246, 0.5);
		background: transparent;
		color: #60a5fa;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.63rem;
		cursor: pointer;
		transition: background 0.1s, border-color 0.1s, color 0.1s;
		text-align: center;
		line-height: 1.5;
	}

	.undo-btn:hover {
		background: rgba(59, 130, 246, 0.14);
		border-color: #3b82f6;
		color: #93c5fd;
	}

	.undo-btn:active {
		background: rgba(59, 130, 246, 0.22);
	}

	.undo-btn:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}
</style>
