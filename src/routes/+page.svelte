<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { activities, clearing, lastMode, clearActivities } from '$lib/stores/session';
	import DropZone from '$lib/components/ui/DropZone.svelte';

	onMount(() => {
		if (get(activities).length > 0) {
			clearing.set(true);
			clearActivities();
			clearing.set(false);
		}

		// If a ?sync= param is present on the landing page URL, remove it from the
		// address bar.  The actual identity adoption is handled in +layout.svelte
		// onMount (which runs before this one), so all we need to do here is clean
		// the URL so it does not appear in the browser history.
		const syncParam = page.url.searchParams.get('sync');
		if (syncParam) {
			const cleanUrl = new URL(page.url);
			cleanUrl.searchParams.delete('sync');
			history.replaceState(null, '', cleanUrl.pathname + (cleanUrl.search || ''));
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
