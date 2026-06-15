<script lang="ts">
	import { activeChannels } from '$lib/stores/session';
	import { CHANNEL_META, type ChannelKey } from '$lib/types';
	import type { AnomalyCount } from './DeviceToggleBar.utils';

	let { channels, anomalyCounts = undefined }: {
		channels: ChannelKey[];
		anomalyCounts?: Map<string, AnomalyCount>;
	} = $props();

	function toggle(ch: ChannelKey) {
		activeChannels.update(list =>
			list.includes(ch) ? list.filter(c => c !== ch) : [...list, ch]
		);
	}
</script>

<div class="bar">
	{#each channels as ch}
		{@const ac = anomalyCounts?.get(ch)}
		<button
			class="pill"
			class:active={$activeChannels.includes(ch)}
			onclick={() => toggle(ch)}
		>{CHANNEL_META[ch].label}{#if ac?.total}<span class="anomaly-badge" title="{ac.spikes > 0 ? `${ac.spikes} spike${ac.spikes > 1 ? 's' : ''}` : ''}{ac.dropouts > 0 ? `${ac.spikes > 0 ? ', ' : ''}${ac.dropouts} dropout${ac.dropouts > 1 ? 's' : ''}` : ''}"> ⚠{ac.total}</span>{/if}</button>
	{/each}
</div>

<style>
	.bar {
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
	}

	.pill.active {
		background: #1e3a5f;
		color: #60a5fa;
		border-color: #3b82f6;
	}

	.anomaly-badge {
		color: #ef4444;
		font-size: 0.6rem;
		font-weight: 600;
		vertical-align: middle;
		white-space: nowrap;
	}
</style>
