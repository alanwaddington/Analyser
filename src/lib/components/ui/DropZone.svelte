<script lang="ts">
	import { get } from 'svelte/store';
	import { parseInWorker, ParseCancelledError } from '$lib/fit';
	import { getAllLabels } from '$lib/stores/deviceLabels';
	import { activities, addActivity, clearActivities } from '$lib/stores/session';
	import { addToast } from '$lib/stores/toast';
	import { MAX_FILES } from '$lib/types';
	import type { ParseStage } from '$lib/types';

	let { compact = false, singleFile = false }: { compact?: boolean; singleFile?: boolean } = $props();

	interface PendingFile {
		filename: string;
		stage: ParseStage;
		fileSize: number;
		startedAt: number;
		cancel: () => void;
	}

	let dragover = $state(false);
	let warning = $state('');
	let error = $state('');
	let inputEl: HTMLInputElement = $state(null!);
	let pendingFiles = $state<Map<string, PendingFile>>(new Map());

	// In singleFile mode the input accepts one file at a time
	const multiple = $derived(!singleFile);

	function dispatchFile(file: File): void {
		const key = crypto.randomUUID();
		const pending: PendingFile = {
			filename: file.name,
			stage: 'queued',
			fileSize: file.size,
			startedAt: Date.now(),
			cancel: () => {},
		};
		pendingFiles = new Map(pendingFiles).set(key, pending);

		const removePending = () => {
			const next = new Map(pendingFiles);
			next.delete(key);
			pendingFiles = next;
		};

		const updateStage = (stage: ParseStage) => {
			const entry = pendingFiles.get(key);
			if (entry) {
				pendingFiles = new Map(pendingFiles).set(key, { ...entry, stage });
			}
		};

		file.arrayBuffer().then(buffer => {
			const labels = getAllLabels();
			const job = parseInWorker(buffer, file.name, labels, updateStage);

			// Store cancel function so the UI can call it
			const entry = pendingFiles.get(key);
			if (entry) {
				pendingFiles = new Map(pendingFiles).set(key, { ...entry, stage: 'parsing', cancel: job.cancel });
			}

			job.promise
				.then(({ activity, toasts }) => {
					addActivity(activity);
					toasts.forEach(t => addToast(t.message, t.level));
					removePending();
				})
				.catch((e: Error) => {
					if (e instanceof ParseCancelledError) {
						removePending();
						return;
					}
					const msg = `${file.name}: ${e.message}`;
					error = error ? `${error}; ${msg}` : msg;
					addToast(msg, 'error');
					removePending();
				});
		});
	}

	async function handleFiles(files: FileList | File[]) {
		warning = '';
		error = '';

		const fitFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.fit'));
		if (fitFiles.length === 0) return;

		if (singleFile) {
			// Replace mode: clear existing activities then load only the first file
			clearActivities();
			dispatchFile(fitFiles[0]);
			return;
		}

		const currentCount = get(activities).length + pendingFiles.size;
		if (currentCount >= MAX_FILES) {
			warning = `Maximum ${MAX_FILES} files — remove one before adding another`;
			return;
		}

		let skipped = 0;
		for (const file of fitFiles) {
			const count = get(activities).length + pendingFiles.size;
			if (count >= MAX_FILES) {
				skipped++;
				continue;
			}
			dispatchFile(file);
		}
		if (skipped > 0) {
			warning = `Maximum ${MAX_FILES} files — ${skipped} file(s) not loaded`;
		}
	}

	const PARSE_BYTES_PER_MS = 1000; // ~1 MB/s conservative estimate across device types

	let now = $state(Date.now());

	$effect(() => {
		if (pendingFiles.size === 0) return;
		const id = setInterval(() => { now = Date.now(); }, 500);
		return () => clearInterval(id);
	});

	function stageLabel(stage: ParseStage): string {
		const labels: Record<ParseStage, string> = {
			queued: 'Queued',
			parsing: 'Parsing binary data…',
			normalising: 'Normalising records…',
			detecting_anomalies: 'Detecting anomalies…',
			building_streams: 'Building device streams…',
		};
		return labels[stage] ?? stage;
	}

	const STAGE_INDEX: Record<ParseStage, number> = {
		queued: -1,
		parsing: 0,
		normalising: 1,
		detecting_anomalies: 2,
		building_streams: 3,
	};

	const PIPELINE_STAGES = [
		{ label: 'Parse' },
		{ label: 'Normalise' },
		{ label: 'Detect' },
		{ label: 'Build' },
	];

	function estimateRemainingSeconds(fileSize: number, startedAt: number): number | null {
		const totalMs = fileSize / PARSE_BYTES_PER_MS;
		const elapsedMs = now - startedAt;
		const remainingS = (totalMs - elapsedMs) / 1000;
		return remainingS >= 1 ? Math.round(remainingS) : null;
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragover = true;
	}

	function onDragLeave() {
		dragover = false;
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragover = false;
		if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
	}

	function onInput() {
		if (inputEl.files) handleFiles(inputEl.files);
		inputEl.value = '';
	}
</script>

{#if compact}
	<label
		class="dropzone-compact"
		class:dragover
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<input bind:this={inputEl} type="file" accept=".fit" {multiple} hidden oninput={onInput} />
		{singleFile ? '↻ Replace file' : '+ Add files'}
	</label>
{:else}
	<label
		class="dropzone"
		class:dragover
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<input bind:this={inputEl} type="file" accept=".fit" {multiple} hidden oninput={onInput} />
		<span class="icon">⬇</span>
		<p class="primary">Drop .fit files here</p>
		<p class="secondary">.fit supported</p>
		<span class="browse-btn">Browse files</span>
	</label>
{/if}

{#if pendingFiles.size > 0}
	{#if compact}
		<!-- Compact mode: slim rows -->
		<div class="compact-list">
			{#each [...pendingFiles.entries()] as [key, pending] (key)}
				<div class="compact-row">
					<span class="compact-spinner" aria-hidden="true"></span>
					<span class="compact-name" title={pending.filename}>{pending.filename}</span>
					<button
						class="compact-cancel"
						onclick={() => pending.cancel()}
						aria-label="Cancel parsing {pending.filename}"
					>✕</button>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Full mode: pipeline cards -->
		<div class="pipeline-list">
			{#each [...pendingFiles.entries()] as [key, pending] (key)}
				{@const remaining = estimateRemainingSeconds(pending.fileSize, pending.startedAt)}
				{@const activeIdx = STAGE_INDEX[pending.stage]}
				<div class="pipeline-card" role="status" aria-label="Parsing {pending.filename}">
					<!-- Animated scan overlay -->
					<div class="scan-overlay" aria-hidden="true"></div>

					<!-- Header row -->
					<div class="card-header">
						<span class="fit-badge">FIT</span>
						<span class="card-filename" title={pending.filename}>{pending.filename}</span>
						<div class="card-actions">
							{#if remaining !== null}
								<span class="card-eta" aria-live="polite">~{remaining}s</span>
							{/if}
							<button
								class="card-cancel"
								onclick={() => pending.cancel()}
								aria-label="Cancel parsing {pending.filename}"
								title="Cancel"
							>✕</button>
						</div>
					</div>

					<!-- Pipeline track -->
					<div class="pipeline-track" aria-hidden="true">
						{#each PIPELINE_STAGES as ps, i}
							{#if i > 0}
								<div
									class="track-line"
									class:track-line-done={i <= activeIdx}
								></div>
							{/if}
							<div class="track-node-wrap">
								<div
									class="track-node"
									class:track-node-done={i < activeIdx}
									class:track-node-active={i === activeIdx}
									class:track-node-pending={i > activeIdx}
								>
									{#if i < activeIdx}<span class="node-check">✓</span>{/if}
								</div>
								<span
									class="track-label"
									class:track-label-done={i < activeIdx}
									class:track-label-active={i === activeIdx}
								>{ps.label}</span>
							</div>
						{/each}
					</div>

					<!-- Status footer -->
					<div class="card-footer">
						<span class="card-status">{stageLabel(pending.stage)}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/if}

{#if warning}
	<p class="msg warning">{warning}</p>
{/if}
{#if error}
	<p class="msg error">{error}</p>
{/if}

<style>
	/* ── Drop zone ───────────────────────────────────────────────── */

	.dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		max-width: 480px;
		padding: 3rem 2rem;
		border: 2px dashed var(--color-border);
		border-radius: 12px;
		color: var(--color-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		text-align: center;
	}

	.dropzone.dragover {
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.icon {
		font-size: 2.5rem;
		line-height: 1;
	}

	.primary {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.dropzone.dragover .primary {
		color: #3b82f6;
	}

	.secondary {
		margin: 0;
		font-size: 0.8rem;
	}

	.browse-btn {
		margin-top: 0.5rem;
		padding: 0.4rem 1.2rem;
		background: #3b82f6;
		color: #fff;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.dropzone-compact {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.5rem 1rem;
		border: 1.5px dashed var(--color-border);
		border-radius: 6px;
		color: var(--color-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.dropzone-compact.dragover {
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.msg {
		margin: 0.4rem 0 0;
		font-size: 0.8rem;
	}

	.warning { color: #f59e0b; }
	.error   { color: #ef4444; }

	/* ── Compact progress (sidebar / mobile) ─────────────────────── */

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.compact-list {
		margin: 0.4rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.compact-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.compact-spinner {
		flex-shrink: 0;
		width: 11px;
		height: 11px;
		border: 2px solid var(--color-border);
		border-top-color: #38bdf8;
		border-radius: 50%;
		animation: spin 0.75s linear infinite;
	}

	.compact-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.75rem;
		color: var(--color-text);
	}

	.compact-cancel {
		flex-shrink: 0;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-muted);
		padding: 0 0.1rem;
		font-size: 0.65rem;
		line-height: 1;
		border-radius: 3px;
		transition: color 0.1s;
	}

	.compact-cancel:hover { color: #ef4444; }

	/* ── Pipeline cards ──────────────────────────────────────────── */

	@keyframes scan-sweep {
		0%   { transform: translateX(-100%); }
		100% { transform: translateX(250%); }
	}

	@keyframes node-pulse {
		0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.5); }
		50%       { box-shadow: 0 0 0 7px rgba(56, 189, 248, 0); }
	}

	@keyframes card-in {
		from { opacity: 0; transform: translateY(-6px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.pipeline-list {
		margin: 0.75rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 100%;
		max-width: 480px;
	}

	.pipeline-card {
		position: relative;
		overflow: hidden;
		padding: 0.85rem 1rem 0.75rem;
		background: var(--color-card, #0a0f1a);
		border: 1px solid var(--color-border);
		border-left: 3px solid #38bdf8;
		border-radius: 8px;
		animation: card-in 0.2s ease-out both;
	}

	/* Scan-line animation sweeping across the card */
	.scan-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}

	.scan-overlay::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 40%;
		height: 100%;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(56, 189, 248, 0.06) 40%,
			rgba(56, 189, 248, 0.1) 50%,
			rgba(56, 189, 248, 0.06) 60%,
			transparent 100%
		);
		animation: scan-sweep 2.4s ease-in-out infinite;
	}

	/* Header */
	.card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		min-width: 0;
	}

	.fit-badge {
		flex-shrink: 0;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.12);
		border: 1px solid rgba(56, 189, 248, 0.25);
		border-radius: 3px;
		padding: 0.1em 0.4em;
		line-height: 1.5;
	}

	.card-filename {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-text);
		font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
	}

	.card-actions {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.card-eta {
		font-size: 0.72rem;
		color: #38bdf8;
		font-variant-numeric: tabular-nums;
		font-family: ui-monospace, monospace;
		opacity: 0.9;
	}

	.card-cancel {
		background: none;
		border: 1px solid transparent;
		cursor: pointer;
		color: var(--color-muted);
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		border-radius: 4px;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
		padding: 0;
	}

	.card-cancel:hover {
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.3);
		background: rgba(239, 68, 68, 0.08);
	}

	/* Pipeline track */
	.pipeline-track {
		display: flex;
		align-items: flex-start;
		gap: 0;
		margin-bottom: 0.6rem;
	}

	.track-node-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		flex-shrink: 0;
	}

	.track-node {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		transition: border-color 0.2s, background 0.2s;
	}

	.track-node-done {
		background: #22c55e;
		border-color: #22c55e;
	}

	.track-node-active {
		background: #38bdf8;
		border-color: #38bdf8;
		animation: node-pulse 1.5s ease-in-out infinite;
	}

	.track-node-pending {
		background: transparent;
		border-color: var(--color-border);
	}

	.node-check {
		color: #fff;
		font-size: 0.6rem;
		font-weight: 700;
		line-height: 1;
	}

	.track-label {
		font-size: 0.62rem;
		color: var(--color-muted);
		white-space: nowrap;
		letter-spacing: 0.02em;
		transition: color 0.2s;
		text-align: center;
	}

	.track-label-done   { color: #22c55e; }
	.track-label-active { color: #38bdf8; font-weight: 600; }

	.track-line {
		flex: 1;
		height: 2px;
		background: var(--color-border);
		margin-top: 10px; /* align with node centre */
		transition: background 0.3s;
		border-radius: 1px;
	}

	.track-line-done {
		background: #22c55e;
	}

	/* Footer status */
	.card-footer {
		border-top: 1px solid var(--color-border);
		padding-top: 0.5rem;
		margin-top: 0.05rem;
	}

	.card-status {
		font-size: 0.72rem;
		color: var(--color-muted);
		font-style: italic;
	}

	@media (prefers-reduced-motion: reduce) {
		.scan-overlay::after { animation: none; }
		.track-node-active   { animation: none; }
		.pipeline-card       { animation: none; }
		.compact-spinner     { animation: none; }
	}
</style>
