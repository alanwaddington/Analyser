<script lang="ts">
	let {
		gradientMode,
		onToggle,
		disabled = false,
	}: {
		/** Whether the gradient style is currently active */
		gradientMode: boolean;
		/** Called when the user toggles the mode */
		onToggle: () => void;
		disabled?: boolean;
	} = $props();
</script>

<button
	class="strip-toggle"
	onclick={onToggle}
	{disabled}
	aria-pressed={gradientMode}
	title={gradientMode ? 'Switch to line style' : 'Switch to gradient style'}
>
	{#if gradientMode}
		<span aria-hidden="true">∿</span> Gradient
	{:else}
		<span aria-hidden="true">▬</span> Line
	{/if}
</button>

<style>
	.strip-toggle {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.68rem;
		cursor: pointer;
		transition: background 0.1s, border-color 0.1s, color 0.1s;
		flex-shrink: 0;
	}

	.strip-toggle[aria-pressed="true"] {
		background: rgba(59, 130, 246, 0.12);
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.strip-toggle:hover:not(:disabled) {
		background: rgba(59, 130, 246, 0.08);
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.strip-toggle:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.strip-toggle:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
