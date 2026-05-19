<script lang="ts">
	import { activities, referenceIndex, removeActivity } from '$lib/stores/session';
	import { FILE_COLOURS } from '$lib/types';

	let { mode }: { mode: 'compare' | 'event' } = $props();

	function formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatDate(d: Date): string {
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
	}
</script>

<ul class="file-list">
	{#each $activities as activity, i}
		{@const colour = FILE_COLOURS[i % FILE_COLOURS.length]}
		{@const isRef = mode === 'event' && i === $referenceIndex}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<li
			class="file-row"
			class:event-row={mode === 'event'}
			class:ref-row={isRef}
			style={isRef ? 'border-left: 3px solid #f59e0b; padding-left: 9px;' : ''}
			role={mode === 'event' ? 'button' : undefined}
			tabindex={mode === 'event' ? 0 : undefined}
			onclick={() => mode === 'event' && referenceIndex.set(i)}
			onkeydown={(e) => mode === 'event' && e.key === 'Enter' && referenceIndex.set(i)}
		>
			<span class="colour-dot" style="background:{colour}"></span>
			<div class="file-info">
				<span class="file-name">{activity.filename}</span>
				{#if mode === 'compare'}
					<span class="file-meta">{activity.devices.length} device{activity.devices.length !== 1 ? 's' : ''}</span>
				{:else}
					<span class="file-meta">{formatDate(activity.startTime)} · {formatTime(activity.totalElapsedTime)}</span>
				{/if}
			</div>
			{#if isRef}
				<span class="ref-badge">Reference</span>
			{/if}
			<button
				class="remove-btn"
				onclick={(e) => { e.stopPropagation(); removeActivity(activity.id); }}
				aria-label="Remove {activity.filename}"
			>×</button>
		</li>
	{/each}
</ul>

<style>
	.file-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.file-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px 6px 12px;
		border-radius: 6px;
		cursor: default;
		position: relative;
	}

	.event-row {
		cursor: pointer;
	}

	.event-row:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.colour-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.file-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.file-name {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-meta {
		font-size: 0.7rem;
		color: var(--color-muted);
	}

	.ref-badge {
		font-size: 0.65rem;
		background: #f59e0b22;
		color: #f59e0b;
		border: 1px solid #f59e0b44;
		border-radius: 4px;
		padding: 1px 5px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.remove-btn {
		background: none;
		border: none;
		color: var(--color-muted);
		cursor: pointer;
		font-size: 1rem;
		padding: 0 4px;
		line-height: 1;
		flex-shrink: 0;
	}

	.remove-btn:hover {
		color: #f43f5e;
	}
</style>
