<script lang="ts">
	import { onDestroy } from 'svelte';

	let { onCopy }: { onCopy: () => Promise<void> } = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function handleClick() {
		onCopy(); // errors handled internally (toast)
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => { copied = false; }, 2000);
	}

	onDestroy(() => clearTimeout(timer));
</script>

<button
	class="session-link-btn"
	class:session-link-btn--copied={copied}
	onclick={handleClick}
	aria-label={copied ? 'Session link copied to clipboard' : 'Copy session link to clipboard'}
>
	<span class="session-link-icon" aria-hidden="true">
		{#if copied}
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
				<path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		{:else}
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
				<path d="M5.5 8.5L8.5 5.5M6.5 3.5L7.414 2.586A2 2 0 0 1 10.243 5.414L9.329 6.328M7.5 10.5L6.586 11.414A2 2 0 0 1 3.757 8.586L4.671 7.672" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
			</svg>
		{/if}
	</span>
	<span class="session-link-label">
		{#if copied}✓ Copied!{:else}Copy session link{/if}
	</span>
</button>

<style>
	.session-link-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 3px 0;
		border: none;
		background: transparent;
		color: var(--color-muted);
		font-size: 0.75rem;
		cursor: pointer;
		text-align: left;
		border-radius: 4px;
		transition: color 0.1s;
	}

	.session-link-btn:hover {
		color: var(--color-text);
	}

	.session-link-btn:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.session-link-btn--copied {
		color: #10b981;
	}

	.session-link-btn--copied:hover {
		color: #34d399;
	}

	:global([data-theme="light"]) .session-link-btn--copied {
		color: #16a34a;
	}

	.session-link-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.session-link-label {
		flex: 1;
		white-space: nowrap;
	}
</style>
