<script lang="ts">
	import { athleteProfile, setProfileField } from '$lib/stores/athleteProfile';
	import type { AthleteProfile } from '$lib/types';

	let isOpen = $state(false);

	function toggle() {
		isOpen = !isOpen;
	}

	// Per-field local input state (strings, to preserve user typing)
	let inputs = $state<Record<keyof AthleteProfile, string>>({
		weight:       '',
		ftp:          '',
		maxHrCycling: '',
		cp:           '',
		maxHrRunning: '',
		lthr:         '',
	});

	// Sync inputs from store when panel opens (picks up persisted values)
	$effect(() => {
		if (isOpen) {
			const p = $athleteProfile;
			inputs.weight       = p.weight        != null ? String(p.weight)       : '';
			inputs.ftp          = p.ftp            != null ? String(p.ftp)          : '';
			inputs.maxHrCycling = p.maxHrCycling   != null ? String(p.maxHrCycling) : '';
			inputs.cp           = p.cp             != null ? String(p.cp)           : '';
			inputs.maxHrRunning = p.maxHrRunning   != null ? String(p.maxHrRunning) : '';
			inputs.lthr         = p.lthr           != null ? String(p.lthr)         : '';
		}
	});

	// Per-field validation warnings
	const warnings = $derived.by<Partial<Record<keyof AthleteProfile, string>>>(() => {
		const w: Partial<Record<keyof AthleteProfile, string>> = {};
		const ftp  = parseFloat(inputs.ftp);
		const cp   = parseFloat(inputs.cp);
		const wt   = parseFloat(inputs.weight);
		const mhc  = parseFloat(inputs.maxHrCycling);
		const mhr  = parseFloat(inputs.maxHrRunning);
		const lthr = parseFloat(inputs.lthr);
		if (!isNaN(ftp)  && ftp  > 600) w.ftp          = 'FTP above 600 W seems high';
		if (!isNaN(cp)   && cp   > 600) w.cp            = 'CP above 600 W seems high';
		if (!isNaN(wt)   && wt   < 30)  w.weight        = 'Weight below 30 kg seems low';
		if (!isNaN(wt)   && wt   > 200) w.weight        = 'Weight above 200 kg seems high';
		if (!isNaN(mhc)  && mhc  > 250) w.maxHrCycling  = 'Max HR above 250 bpm seems high';
		if (!isNaN(mhr)  && mhr  > 250) w.maxHrRunning  = 'Max HR above 250 bpm seems high';
		if (!isNaN(lthr) && lthr > 250) w.lthr          = 'LTHR above 250 bpm seems high';
		return w;
	});

	function commit(key: keyof AthleteProfile, raw: string | number | undefined): void {
		const str = raw == null ? '' : String(raw);
		const val = str.trim() === '' ? undefined : parseFloat(str);
		setProfileField(key, (val != null && isNaN(val)) ? undefined : val);
	}

	function onKeydown(e: KeyboardEvent, key: keyof AthleteProfile, raw: string | number | undefined): void {
		if (e.key === 'Enter') {
			commit(key, raw);
			(e.currentTarget as HTMLInputElement).blur();
		}
	}
</script>

<!-- Toggle row — always visible -->
<button class="toggle-row" onclick={toggle} aria-expanded={isOpen} aria-label="Toggle profile settings">
	<span class="toggle-icon-wrap" aria-hidden="true">⚖</span>
	<span class="toggle-label">Profile</span>
	<span class="toggle-chevron" class:open={isOpen} aria-hidden="true">▾</span>
</button>

{#if isOpen}
	<div class="profile-panel">
		<!-- General -->
		<div class="field-row">
			<label class="field-label" for="ap-weight">Weight</label>
			<input
				id="ap-weight"
				class="field-input"
				type="number"
				inputmode="numeric"
				min="0"
				bind:value={inputs.weight}
				onblur={() => commit('weight', inputs.weight)}
				onkeydown={(e) => onKeydown(e, 'weight', inputs.weight)}
				aria-label="Body weight in kilograms"
			/>
			<span class="field-unit">kg</span>
		</div>
		{#if warnings.weight}
			<p class="field-warning">{warnings.weight}</p>
		{/if}

		<div class="field-group-divider"></div>

		<!-- Cycling -->
		<span class="field-group-label">Cycling</span>
		<div class="field-row">
			<label class="field-label" for="ap-ftp">FTP</label>
			<input
				id="ap-ftp"
				class="field-input"
				type="number"
				inputmode="numeric"
				min="0"
				bind:value={inputs.ftp}
				onblur={() => commit('ftp', inputs.ftp)}
				onkeydown={(e) => onKeydown(e, 'ftp', inputs.ftp)}
				aria-label="Functional Threshold Power in watts"
			/>
			<span class="field-unit">W</span>
		</div>
		{#if warnings.ftp}
			<p class="field-warning">{warnings.ftp}</p>
		{/if}

		<div class="field-row">
			<label class="field-label" for="ap-maxhrc">Max HR</label>
			<input
				id="ap-maxhrc"
				class="field-input"
				type="number"
				inputmode="numeric"
				min="0"
				bind:value={inputs.maxHrCycling}
				onblur={() => commit('maxHrCycling', inputs.maxHrCycling)}
				onkeydown={(e) => onKeydown(e, 'maxHrCycling', inputs.maxHrCycling)}
				aria-label="Maximum heart rate for cycling in beats per minute"
			/>
			<span class="field-unit">bpm</span>
		</div>
		{#if warnings.maxHrCycling}
			<p class="field-warning">{warnings.maxHrCycling}</p>
		{/if}

		<div class="field-group-divider"></div>

		<!-- Running -->
		<span class="field-group-label">Running</span>
		<div class="field-row">
			<label class="field-label" for="ap-cp">CP</label>
			<input
				id="ap-cp"
				class="field-input"
				type="number"
				inputmode="numeric"
				min="0"
				bind:value={inputs.cp}
				onblur={() => commit('cp', inputs.cp)}
				onkeydown={(e) => onKeydown(e, 'cp', inputs.cp)}
				aria-label="Critical Power in watts"
			/>
			<span class="field-unit">W</span>
		</div>
		{#if warnings.cp}
			<p class="field-warning">{warnings.cp}</p>
		{/if}

		<div class="field-row">
			<label class="field-label" for="ap-maxhrr">Max HR</label>
			<input
				id="ap-maxhrr"
				class="field-input"
				type="number"
				inputmode="numeric"
				min="0"
				bind:value={inputs.maxHrRunning}
				onblur={() => commit('maxHrRunning', inputs.maxHrRunning)}
				onkeydown={(e) => onKeydown(e, 'maxHrRunning', inputs.maxHrRunning)}
				aria-label="Maximum heart rate for running in beats per minute"
			/>
			<span class="field-unit">bpm</span>
		</div>
		{#if warnings.maxHrRunning}
			<p class="field-warning">{warnings.maxHrRunning}</p>
		{/if}

		<div class="field-row">
			<label class="field-label" for="ap-lthr">LTHR</label>
			<input
				id="ap-lthr"
				class="field-input"
				type="number"
				inputmode="numeric"
				min="0"
				bind:value={inputs.lthr}
				onblur={() => commit('lthr', inputs.lthr)}
				onkeydown={(e) => onKeydown(e, 'lthr', inputs.lthr)}
				aria-label="Lactate Threshold Heart Rate in beats per minute"
			/>
			<span class="field-unit">bpm</span>
		</div>
		{#if warnings.lthr}
			<p class="field-warning">{warnings.lthr}</p>
		{/if}
	</div>
{/if}


<style>
	/* Toggle row — matches SyncPanel's .toggle-row exactly */
	.toggle-row {
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

	.toggle-row:hover { color: var(--color-text); }

	.toggle-row:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.toggle-icon-wrap {
		font-size: 0.85rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.toggle-label {
		flex: 1;
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.toggle-row:hover .toggle-label { color: var(--color-text); }

	.toggle-chevron {
		font-size: 0.65rem;
		color: var(--color-muted);
		transition: transform 0.2s;
	}

	.toggle-chevron.open { transform: rotate(180deg); }

	/* Expanded panel */
	.profile-panel {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 8px 0;
		border-bottom: 1px solid var(--color-border);
		margin-top: 4px;
	}

	.field-group-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		padding-top: 2px;
	}

	.field-group-divider {
		height: 1px;
		background: var(--color-border);
		margin: 2px 0;
	}

	.field-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.field-label {
		flex: 1;
		font-size: 0.68rem;
		color: var(--color-muted);
		white-space: nowrap;
	}

	.field-input {
		width: 56px;
		height: 24px;
		padding: 0 6px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-bg);
		color: var(--color-text);
		font-size: 0.75rem;
		text-align: right;
		outline: none;
		transition: border-color 0.1s;
		-moz-appearance: textfield;
	}

	.field-input::-webkit-inner-spin-button,
	.field-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.field-input:focus { border-color: #3b82f6; }

	.field-unit {
		font-size: 0.65rem;
		color: var(--color-muted);
		width: 24px;
		text-align: right;
		flex-shrink: 0;
	}

	.field-warning {
		margin: 0 0 0 0;
		font-size: 0.65rem;
		color: #f59e0b;
		padding-left: 0;
	}
</style>
