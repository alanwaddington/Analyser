<script lang="ts">
	import { get } from 'svelte/store';
	import { parseFitFile } from '$lib/fit/parser';
	import { activities, addActivity, clearActivities } from '$lib/stores/session';
	import { MAX_FILES } from '$lib/types';

	let { compact = false, singleFile = false }: { compact?: boolean; singleFile?: boolean } = $props();

	let dragover = $state(false);
	let warning = $state('');
	let error = $state('');
	let inputEl: HTMLInputElement = $state(null!);

	// In singleFile mode the input accepts one file at a time
	const multiple = $derived(!singleFile);

	async function handleFiles(files: FileList | File[]) {
		warning = '';
		error = '';

		const fitFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.fit'));
		if (fitFiles.length === 0) return;

		if (singleFile) {
			// Replace mode: clear existing activities then load only the first file
			clearActivities();
			try {
				const buffer = await fitFiles[0].arrayBuffer();
				const activity = await parseFitFile(buffer, fitFiles[0].name);
				addActivity(activity);
			} catch (e) {
				error = `${fitFiles[0].name}: ${e instanceof Error ? e.message : 'parse failed'}`;
			}
			return;
		}

		if (get(activities).length >= MAX_FILES) {
			warning = `Maximum ${MAX_FILES} files — remove one before adding another`;
			return;
		}

		const errors: string[] = [];
		let skipped = 0;
		for (const file of fitFiles) {
			if (get(activities).length >= MAX_FILES) {
				skipped++;
				continue;
			}
			try {
				const buffer = await file.arrayBuffer();
				const activity = await parseFitFile(buffer, file.name);
				addActivity(activity);
			} catch (e) {
				errors.push(`${file.name}: ${e instanceof Error ? e.message : 'parse failed'}`);
			}
		}
		if (skipped > 0) {
			warning = `Maximum ${MAX_FILES} files — ${skipped} file(s) not loaded`;
		}
		if (errors.length > 0) {
			error = errors.join('; ');
		}
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
</style>
