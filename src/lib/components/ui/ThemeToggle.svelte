<script lang="ts">
	import { themePreference, setTheme } from '$lib/stores/theme';
	import type { ThemePreference } from '$lib/stores/theme';

	const modes: { value: ThemePreference; icon: string; label: string }[] = [
		{ value: 'system', icon: '🖥', label: 'Sys' },
		{ value: 'light',  icon: '☀',  label: 'Lit' },
		{ value: 'dark',   icon: '🌙',  label: 'Drk' },
	];
</script>

<span class="label">Theme</span>
<div class="pills" role="group" aria-label="Theme">
	{#each modes as mode}
		<button
			class="pill"
			class:active={$themePreference === mode.value}
			onclick={() => setTheme(mode.value)}
		>
			<span class="icon" class:icon-active={$themePreference === mode.value}>{mode.icon}</span>
			{mode.label}
		</button>
	{/each}
</div>

<style>
	.label {
		display: block;
		font-size: 0.75rem;
		color: var(--color-muted);
		margin-bottom: 4px;
	}

	.pills {
		display: flex;
		gap: 4px;
	}

	.pill {
		flex: 1;
		padding: 3px 6px;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-muted);
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
	}

	.pill:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--color-text);
	}

	.pill.active {
		background: #3b82f6;
		color: #fff;
		border-color: #3b82f6;
	}

	.pill:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.icon {
		display: inline-block;
		transition: transform 0.2s;
		font-style: normal;
	}

	.icon-active {
		transform: scale(1.15);
	}
</style>
