<script lang="ts">
	import { activeDeviceIndices } from '$lib/stores/session';
	import { CHANNEL_META, FILE_COLOURS } from '$lib/types';
	import type { CrossFileStream } from '$lib/types';
	import {
		deriveDeviceLabel,
		groupStreamsByChannel,
		isComparableGroup,
	} from '$lib/utils/deviceChannels';
	import { setDeviceLabel, removeDeviceLabel, deviceStorageKey } from '$lib/stores/deviceLabels';

	let { streams, multiFile = false }: {
		streams: CrossFileStream[];
		multiFile?: boolean;
	} = $props();

	// Which devices measure 3+ channels — shown as a single expandable pill
	const MULTI_METRIC_THRESHOLD = 3;

	// Keys of streams with 3+ channels
	const multiMetricKeys = $derived(
		new Set(
			streams
				.filter(cfs => cfs.stream.channels.length >= MULTI_METRIC_THRESHOLD)
				.map(cfs => cfs.key)
		)
	);

	// Streams with no channel data — connected but recorded nothing
	const noDataStreams = $derived(streams.filter(cfs => cfs.stream.channels.length === 0));

	// Streams with at least one channel — can be toggled
	const selectableStreams = $derived(streams.filter(cfs => cfs.stream.channels.length > 0));

	// True when every selectable stream is currently active
	const allSelected = $derived(
		selectableStreams.length > 0 &&
		selectableStreams.every(cfs => $activeDeviceIndices.has(cfs.key))
	);

	// Track which multi-metric pills are expanded (keyed by CrossFileStream.key)
	let expandedDevices = $state(new Set<string>());

	// Inline rename state: key → current edit value (null = not editing)
	let renamingDevice = $state<string | null>(null);
	let renameValue = $state('');

	// File groups for multi-file mode: ordered list derived from stream order
	const fileGroups = $derived.by(() => {
		const seen = new Map<string, { filename: string; colourIndex: number; streams: CrossFileStream[] }>();
		for (const cfs of streams) {
			if (!seen.has(cfs.activity.id)) {
				seen.set(cfs.activity.id, {
					filename: cfs.activity.filename,
					colourIndex: seen.size,
					streams: [],
				});
			}
			seen.get(cfs.activity.id)!.streams.push(cfs);
		}
		return [...seen.values()];
	});

	// Derive visible channel groups for a given subset of streams
	function deriveVisibleGroups(
		groupStreams: CrossFileStream[],
		mmKeys: Set<string>
	): Array<{ channelKey: string; streams: CrossFileStream[]; comparable: boolean }> {
		const groups: Array<{ channelKey: string; streams: CrossFileStream[]; comparable: boolean }> = [];
		const chGroups = groupStreamsByChannel(groupStreams);
		for (const [ch, chStreams] of chGroups) {
			const hasNonMulti = chStreams.some(cfs => !mmKeys.has(cfs.key));
			if (!hasNonMulti && mmKeys.size > 0) continue;
			groups.push({ channelKey: ch, streams: chStreams, comparable: isComparableGroup(chStreams) });
		}
		return groups;
	}

	// Visible channel groups for single-file mode
	const visibleGroups = $derived(deriveVisibleGroups(streams, multiMetricKeys));

	function startRename(key: string, currentLabel: string) {
		renamingDevice = key;
		renameValue = currentLabel;
	}

	function commitRename(cfs: CrossFileStream) {
		const trimmed = renameValue.trim();
		const key = deviceStorageKey(cfs.stream.device);
		if (trimmed && key != null) {
			setDeviceLabel(key, trimmed);
			cfs.stream.device.label = trimmed;
		} else if (!trimmed && key != null) {
			removeDeviceLabel(key);
			cfs.stream.device.label = undefined;
		}
		renamingDevice = null;
	}

	function cancelRename() {
		renamingDevice = null;
	}

	// Svelte action: focuses the element when it mounts.
	// Replaces the `autofocus` HTML attribute to avoid the a11y_autofocus warning —
	// programmatic focus is equivalent but does not trip screen-reader heuristics.
	function focusOnMount(node: HTMLInputElement) { node.focus(); }

	function toggleDevice(key: string) {
		activeDeviceIndices.update(indices => {
			const next = new Set(indices);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}

	function toggleExpanded(key: string) {
		expandedDevices = new Set(expandedDevices);
		if (expandedDevices.has(key)) {
			expandedDevices.delete(key);
		} else {
			expandedDevices.add(key);
		}
	}

	function toggleAll() {
		if (allSelected) {
			activeDeviceIndices.set(new Set());
		} else {
			activeDeviceIndices.set(new Set(selectableStreams.map(cfs => cfs.key)));
		}
	}
</script>

<!--
  Reusable snippets for rendering device pills and channel groups.
  Used by both single-file (flat) and multi-file (grouped) layouts.
-->

{#snippet multiMetricPill(cfs: CrossFileStream)}
	{@const label = deriveDeviceLabel(cfs.stream.device)}
	{@const isActive = $activeDeviceIndices.has(cfs.key)}
	{@const isExpanded = expandedDevices.has(cfs.key)}
	<div class="multi-device">
		<div class="multi-row">
			<button
				class="pill"
				class:active={isActive}
				onclick={() => toggleDevice(cfs.key)}
				aria-pressed={isActive}
			>{label}</button>
			<button
				class="expand-btn"
				class:expanded={isExpanded}
				onclick={() => toggleExpanded(cfs.key)}
				aria-label="{isExpanded ? 'Collapse' : 'Expand'} channels for {label}"
			>▾</button>
		</div>
		{#if isExpanded}
			<div class="sub-channels">
				{#each cfs.stream.channels as ch}
					<span class="sub-channel">{CHANNEL_META[ch as keyof typeof CHANNEL_META]?.label ?? ch}</span>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet channelGroup(group: { channelKey: string; streams: CrossFileStream[]; comparable: boolean })}
	<div class="channel-group">
		<span class="group-label">
			{CHANNEL_META[group.channelKey as keyof typeof CHANNEL_META]?.label ?? group.channelKey}
			{#if group.comparable}<span class="comparable-dot" title="Multiple devices — comparable">✦</span>{/if}
		</span>
		<div class="group-pills">
			{#each group.streams as cfs (cfs.key)}
				{@const label = deriveDeviceLabel(cfs.stream.device)}
				{@const isActive = $activeDeviceIndices.has(cfs.key)}
				{#if renamingDevice === cfs.key}
					<input
						class="rename-input"
						type="text"
						bind:value={renameValue}
						use:focusOnMount
						onblur={() => commitRename(cfs)}
						onkeydown={(e) => {
							if (e.key === 'Enter') commitRename(cfs);
							else if (e.key === 'Escape') cancelRename();
						}}
						aria-label="Rename device"
					/>
				{:else}
					<button
						class="pill"
						class:active={isActive}
						onclick={() => toggleDevice(cfs.key)}
						ondblclick={() => startRename(cfs.key, label)}
						aria-pressed={isActive}
						title="Double-click to rename"
					>{label}</button>
				{/if}
			{/each}
		</div>
	</div>
{/snippet}

{#snippet noDataSection(noData: CrossFileStream[])}
	{#if noData.length > 0}
		<div class="channel-group">
			<span class="group-label">Connected · no data</span>
			<div class="group-pills">
				{#each noData as cfs (cfs.key)}
					<span
						class="pill pill--no-data"
						title="Connected but no data recorded"
					>{deriveDeviceLabel(cfs.stream.device)}</span>
				{/each}
			</div>
		</div>
	{/if}
{/snippet}

{#if streams.length === 0}
	<p class="empty">No devices detected.</p>
{:else}
	<div class="bar">
		<!-- Select all / Deselect all quick toggle -->
		{#if selectableStreams.length > 1}
			<button
				class="select-all-btn"
				onclick={toggleAll}
				title={allSelected ? 'Deselect all devices' : 'Select all devices'}
			>{allSelected ? 'Deselect all' : 'Select all'}</button>
		{/if}

		{#if multiFile}
			<!-- Multi-file: group by file with colored left-border headers -->
			{#each fileGroups as group}
				{@const groupColour = FILE_COLOURS[group.colourIndex % FILE_COLOURS.length]}
				{@const grpMmKeys = new Set(group.streams.filter(cfs => cfs.stream.channels.length >= MULTI_METRIC_THRESHOLD).map(cfs => cfs.key))}
				{@const grpVisibleGroups = deriveVisibleGroups(group.streams, grpMmKeys)}
				{@const grpNoData = group.streams.filter(cfs => cfs.stream.channels.length === 0)}

				<div class="file-group">
					<div class="file-header" style="border-left-color: {groupColour}">
						<span class="file-name">{group.filename}</span>
					</div>

					<!-- Multi-metric devices for this file -->
					{#each group.streams.filter(cfs => grpMmKeys.has(cfs.key)) as cfs (cfs.key)}
						{@render multiMetricPill(cfs)}
					{/each}

					<!-- Per-channel groups for this file -->
					{#each grpVisibleGroups as grp (grp.channelKey + group.filename)}
						{@render channelGroup(grp)}
					{/each}

					<!-- No-data devices for this file -->
					{@render noDataSection(grpNoData)}
				</div>
			{/each}

		{:else}
			<!-- Single-file: flat layout (identical to previous behaviour) -->

			<!-- Multi-metric devices get a single expandable pill first -->
			{#each streams.filter(cfs => multiMetricKeys.has(cfs.key)) as cfs (cfs.key)}
				{@render multiMetricPill(cfs)}
			{/each}

			<!-- Per-channel groups for regular (non-multi-metric) devices -->
			{#each visibleGroups as group (group.channelKey)}
				{@render channelGroup(group)}
			{/each}

			<!-- Connected devices that recorded no data -->
			{@render noDataSection(noDataStreams)}
		{/if}
	</div>
{/if}

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: flex-start;
	}

	.select-all-btn {
		padding: 3px 10px;
		border-radius: 999px;
		border: 1px dashed var(--color-border);
		background: transparent;
		color: var(--color-muted);
		font-size: 0.75rem;
		cursor: pointer;
		transition: color 0.1s, border-color 0.1s;
		white-space: nowrap;
		align-self: center;
	}

	.select-all-btn:hover {
		color: var(--color-text);
		border-color: var(--color-text);
	}

	.select-all-btn:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	/* ── Multi-file grouping ─────────────────────────────────────── */

	.file-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
		margin-bottom: 4px;
	}

	.file-header {
		border-left: 3px solid; /* color set via inline style */
		padding: 4px 0 2px 8px;
	}

	.file-name {
		font-size: 0.7rem;
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
		max-width: 160px;
	}

	/* ── Channel groups ──────────────────────────────────────────── */

	.channel-group {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.group-label {
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.comparable-dot {
		color: #3b82f6;
		font-size: 0.6rem;
	}

	.group-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	/* ── Pills ───────────────────────────────────────────────────── */

	.pill {
		padding: 3px 10px;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-muted);
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.1s, color 0.1s, border-color 0.1s;
		white-space: nowrap;
	}

	.pill:hover {
		color: var(--color-text);
	}

	.pill.active {
		background: #1e3a5f;
		color: #60a5fa;
		border-color: #3b82f6;
	}

	.pill:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	/* Connected but no data recorded */
	.pill--no-data {
		cursor: default;
		opacity: 0.4;
		border-style: dashed;
	}

	.pill--no-data:hover {
		color: var(--color-muted);
	}

	/* ── Multi-metric expandable pill ───────────────────────────── */

	.multi-device {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.multi-row {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.expand-btn {
		background: none;
		border: none;
		color: var(--color-muted);
		font-size: 0.75rem;
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 4px;
		line-height: 1;
		transition: transform 0.15s, color 0.1s;
	}

	.expand-btn:hover {
		color: var(--color-text);
	}

	.expand-btn.expanded {
		transform: rotate(180deg);
	}

	.sub-channels {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		padding-left: 4px;
	}

	.sub-channel {
		font-size: 0.65rem;
		color: var(--color-muted);
		background: color-mix(in srgb, var(--color-border) 40%, transparent);
		border-radius: 4px;
		padding: 1px 6px;
	}

	.empty {
		font-size: 0.8rem;
		color: var(--color-muted);
	}

	.rename-input {
		padding: 2px 8px;
		border-radius: 999px;
		border: 1px solid #3b82f6;
		background: #1e3a5f;
		color: #60a5fa;
		font-size: 0.75rem;
		outline: none;
		min-width: 80px;
		max-width: 160px;
	}
</style>
