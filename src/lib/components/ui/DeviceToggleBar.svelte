<script lang="ts">
	import { activeDeviceIndices } from '$lib/stores/session';
	import { CHANNEL_META } from '$lib/types';
	import type { DeviceStream } from '$lib/types';
	import {
		deriveDeviceLabel,
		groupStreamsByChannel,
		isComparableGroup,
	} from '$lib/utils/deviceChannels';

	let { deviceStreams }: { deviceStreams: DeviceStream[] } = $props();

	// Which devices measure 3+ channels — shown as a single expandable pill
	const MULTI_METRIC_THRESHOLD = 3;

	const channelGroups = $derived(groupStreamsByChannel(deviceStreams));

	// Devices with 3+ channels get a single expandable pill
	const multiMetricDeviceIndices = $derived(
		new Set(
			deviceStreams
				.filter(s => s.channels.length >= MULTI_METRIC_THRESHOLD)
				.map(s => s.device.deviceIndex)
		)
	);

	// Track which multi-metric pills are expanded
	let expandedDevices = $state(new Set<number>());

	function toggleDevice(deviceIndex: number) {
		activeDeviceIndices.update(indices => {
			const next = new Set(indices);
			if (next.has(deviceIndex)) {
				next.delete(deviceIndex);
			} else {
				next.add(deviceIndex);
			}
			return next;
		});
	}

	function toggleExpanded(deviceIndex: number) {
		expandedDevices = new Set(expandedDevices);
		if (expandedDevices.has(deviceIndex)) {
			expandedDevices.delete(deviceIndex);
		} else {
			expandedDevices.add(deviceIndex);
		}
	}

	// Build the ordered list of channel groups, skipping channels that belong
	// only to multi-metric devices (those are shown under their expandable pill)
	const visibleGroups = $derived(() => {
		const groups: Array<{ channelKey: string; streams: DeviceStream[]; comparable: boolean }> = [];
		for (const [ch, streams] of channelGroups) {
			// If all streams for this channel are multi-metric devices, skip the group
			// (they appear inside the expandable pill instead)
			const hasNonMulti = streams.some(
				s => !multiMetricDeviceIndices.has(s.device.deviceIndex)
			);
			if (!hasNonMulti && multiMetricDeviceIndices.size > 0) continue;
			groups.push({ channelKey: ch, streams, comparable: isComparableGroup(streams) });
		}
		return groups;
	});
</script>

{#if deviceStreams.length === 0}
	<p class="empty">No devices detected.</p>
{:else}
	<div class="bar">
		<!-- Multi-metric devices get a single expandable pill first -->
		{#each deviceStreams.filter(s => multiMetricDeviceIndices.has(s.device.deviceIndex)) as stream (stream.device.deviceIndex)}
			{@const label = deriveDeviceLabel(stream.device)}
			{@const isActive = $activeDeviceIndices.has(stream.device.deviceIndex)}
			{@const isExpanded = expandedDevices.has(stream.device.deviceIndex)}
			<div class="multi-device">
				<div class="multi-row">
					<button
						class="pill"
						class:active={isActive}
						onclick={() => toggleDevice(stream.device.deviceIndex)}
						aria-pressed={isActive}
					>{label}</button>
					<button
						class="expand-btn"
						class:expanded={isExpanded}
						onclick={() => toggleExpanded(stream.device.deviceIndex)}
						aria-label="{isExpanded ? 'Collapse' : 'Expand'} channels for {label}"
					>▾</button>
				</div>
				{#if isExpanded}
					<div class="sub-channels">
						{#each stream.channels as ch}
							<span class="sub-channel">{CHANNEL_META[ch as keyof typeof CHANNEL_META]?.label ?? ch}</span>
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		<!-- Per-channel groups for regular (non-multi-metric) devices -->
		{#each visibleGroups() as group (group.channelKey)}
			<div class="channel-group">
				<span class="group-label">
					{CHANNEL_META[group.channelKey as keyof typeof CHANNEL_META]?.label ?? group.channelKey}
					{#if group.comparable}<span class="comparable-dot" title="Multiple devices — comparable">✦</span>{/if}
				</span>
				<div class="group-pills">
					{#each group.streams as stream (stream.device.deviceIndex)}
						{@const label = deriveDeviceLabel(stream.device)}
						{@const isActive = $activeDeviceIndices.has(stream.device.deviceIndex)}
						<button
							class="pill"
							class:active={isActive}
							onclick={() => toggleDevice(stream.device.deviceIndex)}
							aria-pressed={isActive}
						>{label}</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: flex-start;
	}

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

	/* Multi-metric device pill layout */
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
</style>
