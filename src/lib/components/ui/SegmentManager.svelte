<script lang="ts">
	import { getSegments, addSegment, renameSegment, resizeSegment, removeSegment } from '$lib/stores/customSegments';
	import type { CustomSegment } from '$lib/types';

	let {
		courseKey,
		revision = 0,
		onSegmentsChanged = undefined,
	}: {
		courseKey: string;
		revision?: number;
		onSegmentsChanged?: () => void;
	} = $props();

	// Reactive segment list — re-read when courseKey or revision changes.
	// revision is incremented by the parent when a segment is added externally
	// (e.g. via the Shift+drag brush flow) so the list stays in sync.
	let segments = $state<CustomSegment[]>([]);

	$effect(() => {
		void courseKey;
		void revision;
		segments = getSegments(courseKey);
	});

	function refresh() {
		segments = getSegments(courseKey);
		onSegmentsChanged?.();
	}

	// Per-row edit state
	type RowEdit = { name: string; start: string; end: string };
	let editState = $state<Record<string, RowEdit>>({});
	let confirmDelete = $state<string | null>(null); // segment id pending delete confirmation
	let importError = $state<string | null>(null);

	function startEdit(seg: CustomSegment) {
		editState[seg.id] = {
			name: seg.name,
			start: (seg.startDist / 1000).toFixed(2),
			end: (seg.endDist / 1000).toFixed(2),
		};
	}

	function cancelEdit(id: string) {
		delete editState[id];
		editState = { ...editState };
	}

	function commitEdit(seg: CustomSegment) {
		const e = editState[seg.id];
		if (!e) return;
		const newName = e.name.trim();
		const startDist = parseFloat(e.start) * 1000;
		const endDist = parseFloat(e.end) * 1000;
		if (newName && !isNaN(startDist) && !isNaN(endDist) && startDist < endDist) {
			if (newName !== seg.name) renameSegment(courseKey, seg.id, newName);
			if (startDist !== seg.startDist || endDist !== seg.endDist) {
				resizeSegment(courseKey, seg.id, startDist, endDist);
			}
		}
		cancelEdit(seg.id);
		refresh();
	}

	function requestDelete(id: string) {
		confirmDelete = id;
	}

	function confirmDeleteSeg(id: string) {
		removeSegment(courseKey, id);
		confirmDelete = null;
		cancelEdit(id);
		refresh();
	}

	function cancelDelete() {
		confirmDelete = null;
	}

	// Export: download JSON for this course's segments
	function exportSegments() {
		const data = JSON.stringify(getSegments(courseKey), null, 2);
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `segments-${courseKey}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Import: read JSON and merge segments into the store
	function handleImport(event: Event) {
		importError = null;
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const parsed = JSON.parse(e.target?.result as string);
				if (!Array.isArray(parsed)) throw new Error('Expected a JSON array');
				for (const seg of parsed) {
					if (typeof seg.name !== 'string' ||
						typeof seg.startDist !== 'number' ||
						typeof seg.endDist !== 'number') {
						throw new Error('Invalid segment format — each item needs name, startDist, endDist');
					}
					if (seg.startDist >= seg.endDist) {
						throw new Error(`Invalid segment "${seg.name}" — startDist must be less than endDist`);
					}
					addSegment(courseKey, seg.name, seg.startDist, seg.endDist);
				}
				refresh();
			} catch (err) {
				importError = err instanceof Error ? err.message : 'Invalid JSON file';
			}
		};
		reader.readAsText(file);
		// Reset file input so the same file can be re-imported
		(event.target as HTMLInputElement).value = '';
	}
</script>

<div class="seg-manager">
	<div class="seg-header">
		<span class="seg-title">Custom Segments</span>
		<span class="seg-hint">Shift+drag a chart to add</span>
	</div>

	{#if segments.length === 0}
		<p class="seg-empty">No custom segments yet. Hold <kbd>Shift</kbd> and drag on any chart to create one.</p>
	{:else}
		<ul class="seg-list" role="list">
			{#each segments as seg (seg.id)}
				{@const edit = editState[seg.id]}
				<li class="seg-row">
					{#if edit}
						<div class="seg-row-edit">
							<input
								class="seg-input seg-input--name"
								type="text"
								bind:value={edit.name}
								placeholder="Segment name"
								aria-label="Segment name"
							/>
							<input
								class="seg-input seg-input--dist"
								type="number"
								step="0.01"
								min="0"
								bind:value={edit.start}
								placeholder="Start km"
								aria-label="Start distance (km)"
							/>
							<span class="seg-sep">–</span>
							<input
								class="seg-input seg-input--dist"
								type="number"
								step="0.01"
								min="0"
								bind:value={edit.end}
								placeholder="End km"
								aria-label="End distance (km)"
							/>
							<button class="seg-btn seg-btn--save" onclick={() => commitEdit(seg)} title="Save">✓</button>
							<button class="seg-btn seg-btn--cancel" onclick={() => cancelEdit(seg.id)} title="Cancel">✕</button>
						</div>
					{:else if confirmDelete === seg.id}
						<div class="seg-row-confirm">
							<span class="seg-confirm-text">Delete "{seg.name}"?</span>
							<button class="seg-btn seg-btn--danger" onclick={() => confirmDeleteSeg(seg.id)}>Yes</button>
							<button class="seg-btn seg-btn--cancel" onclick={cancelDelete}>No</button>
						</div>
					{:else}
						<div class="seg-row-view">
							<span class="seg-name">{seg.name}</span>
							<span class="seg-dist">{(seg.startDist / 1000).toFixed(2)}–{(seg.endDist / 1000).toFixed(2)} km</span>
							<button class="seg-btn seg-btn--edit" onclick={() => startEdit(seg)} title="Edit segment">✎</button>
							<button class="seg-btn seg-btn--delete" onclick={() => requestDelete(seg.id)} title="Delete segment">✕</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<div class="seg-actions">
		<button class="seg-action-btn" onclick={exportSegments} title="Download segments as JSON">
			↓ Export JSON
		</button>
		<label class="seg-action-btn seg-action-btn--import" title="Import segments from JSON">
			↑ Import JSON
			<input type="file" accept=".json" onchange={handleImport} class="seg-file-input" />
		</label>
	</div>

	{#if importError}
		<p class="seg-error" role="alert">{importError}</p>
	{/if}
</div>

<style>
	.seg-manager {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 0;
		border-top: 1px solid var(--color-border);
	}

	.seg-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.seg-title {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-muted);
	}

	.seg-hint {
		font-size: 0.65rem;
		color: var(--color-muted);
		opacity: 0.7;
	}

	.seg-empty {
		font-size: 0.72rem;
		color: var(--color-muted);
		margin: 0;
		line-height: 1.4;
	}

	.seg-empty kbd {
		display: inline-block;
		padding: 0 4px;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		font-size: 0.65rem;
		background: var(--color-bg);
	}

	.seg-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.seg-row {
		display: block;
	}

	.seg-row-view,
	.seg-row-edit,
	.seg-row-confirm {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 24px;
	}

	.seg-name {
		flex: 1;
		font-size: 0.75rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.seg-dist {
		font-size: 0.68rem;
		color: var(--color-muted);
		white-space: nowrap;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	/* Edit inputs */
	.seg-input {
		height: 22px;
		padding: 0 5px;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		background: var(--color-bg);
		color: var(--color-text);
		font-size: 0.7rem;
		outline: none;
		transition: border-color 0.1s;
		-moz-appearance: textfield;
	}

	.seg-input::-webkit-inner-spin-button,
	.seg-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
	}

	.seg-input:focus {
		border-color: #3b82f6;
	}

	.seg-input--name {
		flex: 1;
		min-width: 0;
	}

	.seg-input--dist {
		width: 52px;
		flex-shrink: 0;
		text-align: right;
	}

	.seg-sep {
		font-size: 0.7rem;
		color: var(--color-muted);
		flex-shrink: 0;
	}

	/* Action buttons */
	.seg-btn {
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		background: transparent;
		cursor: pointer;
		font-size: 0.7rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.1s, border-color 0.1s, color 0.1s;
		color: var(--color-muted);
	}

	.seg-btn:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.seg-btn--edit:hover {
		background: rgba(59,130,246,0.12);
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.seg-btn--save {
		color: #22c55e;
		border-color: #22c55e;
	}

	.seg-btn--save:hover {
		background: rgba(34,197,94,0.12);
	}

	.seg-btn--cancel:hover,
	.seg-btn--delete:hover {
		background: rgba(239,68,68,0.12);
		border-color: #ef4444;
		color: #ef4444;
	}

	.seg-btn--danger {
		color: #ef4444;
		border-color: #ef4444;
	}

	.seg-btn--danger:hover {
		background: rgba(239,68,68,0.12);
	}

	.seg-confirm-text {
		flex: 1;
		font-size: 0.72rem;
		color: var(--color-text);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Import/export row */
	.seg-actions {
		display: flex;
		gap: 6px;
		padding-top: 2px;
	}

	.seg-action-btn {
		flex: 1;
		padding: 3px 8px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.68rem;
		cursor: pointer;
		text-align: center;
		transition: background 0.1s, border-color 0.1s, color 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.seg-action-btn:hover {
		background: rgba(59,130,246,0.1);
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.seg-action-btn:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.seg-action-btn--import {
		position: relative;
	}

	.seg-file-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}

	.seg-error {
		margin: 0;
		font-size: 0.68rem;
		color: #f59e0b;
	}
</style>
