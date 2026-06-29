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
		const key = `${file.name}-${file.size}-${Date.now()}`;
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

	const PARSE_BYTES_PER_MS = 5000;

	let now = $state(Date.now());

	$effect(() => {
		if (pendingFiles.size === 0) return;
		const id = setInterval(() => { now = Date.now(); }, 500);
		return () => clearInterval(id);
	});

	function stageLabel(stage: ParseStage): string {
		const labels: Record<ParseStage, string> = {
			queued: 'Queued',
			parsing: 'Parsing…',
			normalising: 'Normalising…',
			detecting_anomalies: 'Detecting anomalies…',
			building_streams: 'Building streams…',
		};
		return labels[stage] ?? stage;
	}

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
	<div class="pending-list" class:compact>
		{#each [...pendingFiles.entries()] as [key, pending] (key)}
			{@const remaining = estimateRemainingSeconds(pending.fileSize, pending.startedAt)}
			<div class="pending-row">
				<span class="spinner" aria-hidden="true"></span>
				<span class="pending-name" title={pending.filename}>{pending.filename}</span>
				{#if !compact}
					<span class="pending-stage">{stageLabel(pending.stage)}</span>
					{#if remaining !== null}
						<span class="pending-time">~{remaining}s</span>
					{/if}
				{/if}
				<button
					class="pending-cancel"
					onclick={() => pending.cancel()}
					aria-label="Cancel parsing {pending.filename}"
					title="Cancel"
				>✕</button>
			</div>
		{/each}
	</div>
{/if}

{#if warning}
	<p class="msg warning">{warning}</p>
{/if}
{#if error}
	<p class="msg error">{error}</p>
{/if}

<style>
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

	.warning {
		color: #f59e0b;
	}

	.error {
		color: #ef4444;
	}

	/* ---- parse progress ---- */

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.pending-list {
		margin: 0.5rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.pending-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.5rem;
		background: var(--color-card, var(--color-sidebar));
		border: 1px solid var(--color-border);
		border-radius: 6px;
		min-width: 0;
	}

	.spinner {
		flex-shrink: 0;
		width: 13px;
		height: 13px;
		border: 2px solid var(--color-border);
		border-top-color: #38bdf8;
		border-radius: 50%;
		animation: spin 0.75s linear infinite;
	}

	.pending-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.8rem;
		color: var(--color-text);
	}

	.pending-stage {
		flex-shrink: 0;
		font-size: 0.72rem;
		color: var(--color-muted);
		white-space: nowrap;
	}

	.pending-time {
		flex-shrink: 0;
		font-size: 0.72rem;
		color: #38bdf8;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.pending-cancel {
		flex-shrink: 0;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-muted);
		padding: 0 0.15rem;
		font-size: 0.7rem;
		line-height: 1;
		border-radius: 3px;
		transition: color 0.1s, background 0.1s;
	}

	.pending-cancel:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.08);
	}

	.pending-list.compact .pending-row {
		padding: 0.2rem 0.35rem;
		background: transparent;
		border: none;
		border-radius: 0;
	}

	.pending-list.compact .pending-name {
		font-size: 0.75rem;
	}
</style>
