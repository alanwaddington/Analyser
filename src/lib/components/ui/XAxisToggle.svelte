<script lang="ts">
	import { xAxisMode } from '$lib/stores/session';

	let { eventMode = false }: { eventMode?: boolean } = $props();
</script>

{#if eventMode}
	<span class="label">Align by</span>
{/if}
<div class="pills">
	<button
		class="pill"
		class:active={$xAxisMode === 'time'}
		onclick={() => xAxisMode.set('time')}
	>Time</button>
	<button
		class="pill"
		class:active={$xAxisMode === 'distance'}
		onclick={() => xAxisMode.set('distance')}
	>Distance</button>
</div>

<style>
	.label {
		display: block;
		font-size: 0.75rem;
		color: var(--color-muted);
		margin-bottom: 4px;
	}

	.pills {
		display: flex;
		gap: 4px;
	}

	.pill {
		flex: 1;
		padding: 3px 10px;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-muted);
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}

	.pill.active {
		background: #3b82f6;
		color: #fff;
		border-color: #3b82f6;
	}
</style>
