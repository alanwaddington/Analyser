<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { activities, clearing, lastMode, clearActivities } from '$lib/stores/session';
	import DropZone from '$lib/components/ui/DropZone.svelte';

	onMount(() => {
		if (get(activities).length > 0) {
			clearing.set(true);
			clearActivities();
			clearing.set(false);
		}
	});

	$effect(() => {
		if ($activities.length >= 1 && !$clearing) {
			goto(`/${$lastMode}`);
		}
	});
</script>

<div class="landing">
	{#if !$clearing}
		<DropZone compact={false} />
	{/if}
</div>

<style>
	.landing {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px;
	}
</style>
