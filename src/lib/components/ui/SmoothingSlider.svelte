<script lang="ts">
	import { smoothing } from '$lib/stores/session';
</script>

<div class="control">
	<label class="label" for="smoothing-slider">Smoothing {$smoothing}s</label>
	<input
		id="smoothing-slider"
		type="range"
		min="1"
		max="60"
		step="1"
		bind:value={$smoothing}
		class="slider"
	/>
</div>

<style>
	.control {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.label {
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.slider {
		width: 100%;
		accent-color: #3b82f6;
		cursor: pointer;
	}
</style>
