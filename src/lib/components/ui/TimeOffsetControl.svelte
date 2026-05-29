<script lang="ts">
	import type { Activity, AnchorSource } from '$lib/types';
	import { timeOffsets } from '$lib/stores/session';
	import { nudgeOffset, parseOffset } from './TimeOffsetControl.utils.ts';

	let { activities, autoOffsets, anchorSources = new Map() }: {
		activities: Activity[];
		autoOffsets: Map<string, number>;
		anchorSources?: Map<string, AnchorSource>;
	} = $props();

	const ANCHOR_LABELS: Record<AnchorSource, string> = {
		timer:          'Timer',
		gpsMovement:    'GPS move',
		gpsFix:         'GPS fix',
		fileStart:      'File start',
		workoutStep:    'Workout',
		indoorMovement: 'Indoor',
	};

	const ANCHOR_TITLES: Record<AnchorSource, string> = {
		timer:          'Aligned by FIT timer start event',
		gpsMovement:    'Aligned by first GPS movement',
		gpsFix:         'Aligned by first GPS fix (stationary)',
		fileStart:      'No GPS — aligned by file start time',
		workoutStep:    'Aligned by first workout step',
		indoorMovement: 'Aligned by first indoor movement (speed/power/cadence)',
	};

	let expanded = $state(false);

	// Count of files whose current offset differs from the auto-computed value
	const adjustedCount = $derived(
		activities.slice(1).filter(a => {
			const current = $timeOffsets.get(a.id) ?? 0;
			const auto    = autoOffsets.get(a.id) ?? 0;
			return current !== auto;
		}).length
	);

	function toggle() { expanded = !expanded; }

	function nudge(activityId: string, delta: number): void {
		timeOffsets.update(m => {
			const next = new Map(m);
			const current = next.get(activityId) ?? 0;
			next.set(activityId, nudgeOffset(current, delta));
			return next;
		});
	}

	function setOffset(activityId: string, value: number): void {
		const parsed = parseOffset(value);
		if (parsed === null) return;
		timeOffsets.update(m => {
			const next = new Map(m);
			next.set(activityId, parsed);
			return next;
		});
	}

	function resetOffset(activityId: string, autoValue: number): void {
		timeOffsets.update(m => {
			const next = new Map(m);
			next.set(activityId, autoValue);
			return next;
		});
	}
</script>

<div class="toc-root">
	<button
		class="toc-toggle"
		onclick={toggle}
		aria-expanded={expanded}
		aria-controls="toc-panel"
	>
		<span class="toc-icon" aria-hidden="true">⏱</span>
		Fine-tune timing
		{#if adjustedCount > 0}
			<span class="toc-badge">{adjustedCount} adjusted</span>
		{/if}
		<span class="toc-chevron" class:flipped={expanded} aria-hidden="true">▾</span>
	</button>

	{#if expanded}
		<div class="toc-panel" id="toc-panel">
			{#each activities as activity, i}
				{@const currentOffset = $timeOffsets.get(activity.id) ?? 0}
				{@const autoOffset    = autoOffsets.get(activity.id) ?? 0}
				{@const isAdjusted    = currentOffset !== autoOffset}

				<div class="toc-row">
					<span class="toc-filename" title={activity.filename}>
						{activity.filename}
					</span>

					{#if anchorSources.has(activity.id)}
						{@const source = anchorSources.get(activity.id)!}
						<span
							class="toc-anchor toc-anchor--{source}"
							title={ANCHOR_TITLES[source]}
							aria-label={ANCHOR_TITLES[source]}
						>{ANCHOR_LABELS[source]}</span>
					{/if}

					{#if i === 0}
						<span class="toc-reference">Reference</span>
					{:else}
						<div
							class="toc-controls"
							role="group"
							aria-label="Time offset for {activity.filename}"
						>
							<button
								class="toc-nudge"
								onclick={() => nudge(activity.id, -10)}
								aria-label="Subtract 10 seconds"
							>−10</button>
							<button
								class="toc-nudge"
								onclick={() => nudge(activity.id, -1)}
								aria-label="Subtract 1 second"
							>−1</button>
							<input
								class="toc-input"
								type="number"
								value={currentOffset}
								aria-label="Offset in seconds for {activity.filename}"
								onchange={(e) => setOffset(activity.id, (e.currentTarget as HTMLInputElement).valueAsNumber)}
								onblur={(e)   => setOffset(activity.id, (e.currentTarget as HTMLInputElement).valueAsNumber)}
								onkeydown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
							/>
							<span class="toc-unit" aria-hidden="true">s</span>
							<button
								class="toc-nudge"
								onclick={() => nudge(activity.id, +1)}
								aria-label="Add 1 second"
							>+1</button>
							<button
								class="toc-nudge"
								onclick={() => nudge(activity.id, +10)}
								aria-label="Add 10 seconds"
							>+10</button>
							{#if isAdjusted}
								<button
									class="toc-reset"
									onclick={() => resetOffset(activity.id, autoOffset)}
									title="Reset to auto-computed offset"
									aria-label="Reset offset for {activity.filename}"
								>↺</button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.toc-root {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
	}

	/* ── Toggle button ────────────────────────────────────────────── */

	.toc-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		background: none;
		border: 1px dashed var(--color-border);
		border-radius: 6px;
		color: var(--color-muted);
		font-size: 0.75rem;
		cursor: pointer;
		transition: color 0.1s, border-color 0.1s;
		align-self: flex-start;
	}

	.toc-toggle:hover {
		color: var(--color-text);
		border-color: var(--color-text);
	}

	.toc-toggle:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.toc-icon { font-size: 0.8rem; }

	.toc-badge {
		padding: 1px 6px;
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
		border-radius: 999px;
		font-size: 0.65rem;
		font-weight: 600;
	}

	.toc-chevron {
		font-size: 0.65rem;
		transition: transform 0.15s;
		line-height: 1;
	}

	.toc-chevron.flipped { transform: rotate(180deg); }

	/* ── Expanded panel ───────────────────────────────────────────── */

	.toc-panel {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 10px;
		background: color-mix(in srgb, var(--color-border) 20%, transparent);
		border: 1px solid var(--color-border);
		border-radius: 6px;
	}

	.toc-row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 24px;
	}

	.toc-filename {
		font-size: 0.7rem;
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 110px;
		flex-shrink: 0;
	}

	.toc-reference {
		font-size: 0.7rem;
		color: var(--color-muted);
		font-style: italic;
	}

	/* ── Nudge controls ───────────────────────────────────────────── */

	.toc-controls {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.toc-nudge {
		padding: 2px 6px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		color: var(--color-muted);
		font-size: 0.7rem;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
		white-space: nowrap;
	}

	.toc-nudge:hover {
		background: color-mix(in srgb, var(--color-border) 40%, transparent);
		color: var(--color-text);
	}

	.toc-nudge:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}

	.toc-input {
		width: 48px;
		padding: 2px 4px;
		background: var(--color-card, #0f172a);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		color: var(--color-text);
		font-size: 0.75rem;
		text-align: right;
		font-family: ui-monospace, monospace;
	}

	.toc-input:focus {
		outline: 2px solid #3b82f6;
		outline-offset: 0;
		border-color: #3b82f6;
	}

	/* Hide native number spinners */
	.toc-input::-webkit-inner-spin-button,
	.toc-input::-webkit-outer-spin-button { -webkit-appearance: none; }
	.toc-input { appearance: textfield; -moz-appearance: textfield; }

	.toc-unit {
		font-size: 0.7rem;
		color: var(--color-muted);
	}

	.toc-reset {
		padding: 2px 5px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		color: var(--color-muted);
		font-size: 0.75rem;
		cursor: pointer;
		transition: color 0.1s;
		line-height: 1;
	}

	.toc-reset:hover { color: var(--color-text); }

	.toc-reset:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}

	/* ── Anchor source badge ──────────────────────────────────────────── */

	.toc-anchor {
		padding: 1px 5px;
		border-radius: 999px;
		font-size: 0.6rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		white-space: nowrap;
		flex-shrink: 0;
		cursor: default;
	}

	.toc-anchor--timer,
	.toc-anchor--gpsMovement {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
	}

	.toc-anchor--gpsFix {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
	}

	.toc-anchor--fileStart {
		background: color-mix(in srgb, var(--color-border) 40%, transparent);
		color: var(--color-muted);
	}

	.toc-anchor--workoutStep,
	.toc-anchor--indoorMovement {
		background: rgba(34, 197, 94, 0.15);
		color: #4ade80;
	}
</style>
