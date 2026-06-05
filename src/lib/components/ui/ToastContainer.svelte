<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts, removeToast } from '$lib/stores/toast';

	const MAX_VISIBLE = 3;

	const levelColour: Record<string, string> = {
		info:    '#3b82f6',
		warning: '#f59e0b',
		error:   '#ef4444',
	};

	const levelIcon: Record<string, string> = {
		info:    'ℹ',
		warning: '⚠',
		error:   '✕',
	};
</script>

<div class="toast-container" aria-live="polite" aria-atomic="false">
	{#each $toasts.slice(-MAX_VISIBLE) as toast (toast.id)}
		<div
			class="toast"
			style="--accent: {levelColour[toast.level]}"
			role="status"
			transition:fly={{ y: 12, duration: 200 }}
		>
			<span class="toast-icon" aria-hidden="true">{levelIcon[toast.level]}</span>
			<span class="toast-message">{toast.message}</span>
			<button
				class="toast-dismiss"
				onclick={() => removeToast(toast.id)}
				aria-label="Dismiss notification"
			>×</button>
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		bottom: 16px;
		right: 16px;
		z-index: 200;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 340px;
		width: calc(100vw - 32px);
		pointer-events: none;
	}

	.toast {
		pointer-events: auto;
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 10px 12px;
		background: var(--color-card);
		border: 1px solid var(--color-border);
		border-left: 3px solid var(--accent);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
		font-size: 0.875rem;
		line-height: 1.4;
		color: var(--color-text);
	}

	.toast-icon {
		flex-shrink: 0;
		color: var(--accent);
		font-size: 0.9rem;
		margin-top: 1px;
	}

	.toast-message {
		flex: 1;
	}

	.toast-dismiss {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--color-muted);
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 2px;
		margin-top: -1px;
		border-radius: 2px;
		transition: color 0.15s;
	}

	.toast-dismiss:hover {
		color: var(--color-text);
	}

	.toast-dismiss:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	/* Clear bottom nav bar on phone */
	@media (max-width: 480px) { /* --bp-phone */
		.toast-container {
			bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 8px);
			right: 8px;
			left: 8px;
			width: auto;
			max-width: none;
		}
	}
</style>
