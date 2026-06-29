<script lang="ts">
	import { recordFilter, clearAllFilters, activeFilterCount } from '$lib/stores/filterStore';
	import type { RecordFilter, ChannelRange } from '$lib/stores/filterStore';
	import { cpZoneBoundaries, ftpZoneBoundaries, hrZoneBoundaries, lthrToEstimatedMaxHR } from '$lib/analytics/zones';
	import type { AthleteProfile } from '$lib/types';

	let {
		sport = '',
		powerSource = undefined,
		athleteProfile = {},
		hasAltitude = true,
	}: {
		sport?: string;
		powerSource?: 'stryd' | 'native' | 'cycling' | undefined;
		athleteProfile?: AthleteProfile;
		hasAltitude?: boolean;
	} = $props();

	const isRunning = $derived(sport === 'running');
	const isCycling = $derived(sport === 'cycling' || (!isRunning && powerSource === 'cycling'));

	const powerLabel = $derived(() => {
		if (powerSource === 'stryd') return 'Stryd Power';
		if (powerSource === 'native') return 'Running Power';
		return 'Power';
	});

	const speedLabel = $derived(isRunning ? 'Pace (min/km)' : 'Speed (km/h)');

	const powerZones = $derived(() => {
		if (isRunning && athleteProfile.cp != null) return cpZoneBoundaries(athleteProfile.cp);
		if (!isRunning && athleteProfile.ftp != null) return ftpZoneBoundaries(athleteProfile.ftp);
		return null;
	});

	const hrZones = $derived(() => {
		const maxHR = isRunning
			? (athleteProfile.maxHrRunning ?? athleteProfile.maxHrCycling)
			: (athleteProfile.maxHrCycling ?? athleteProfile.maxHrRunning);
		if (maxHR != null) return hrZoneBoundaries(maxHR);
		if (athleteProfile.lthr != null) return hrZoneBoundaries(lthrToEstimatedMaxHR(athleteProfile.lthr));
		return null;
	});

	const namedPresets = $derived(() => {
		const presets: { label: string; apply: () => void }[] = [];

		if (isRunning && athleteProfile.cp != null) {
			presets.push({ label: 'Above CP', apply: () => setRange('power', { min: athleteProfile.cp }) });
		}
		if (!isRunning && athleteProfile.ftp != null) {
			const ftp = athleteProfile.ftp;
			presets.push({ label: 'Z4+ FTP', apply: () => setRange('power', { min: Math.round(ftp * 0.90) }) });
		}
		const maxHR = isRunning
			? (athleteProfile.maxHrRunning ?? athleteProfile.maxHrCycling)
			: (athleteProfile.maxHrCycling ?? athleteProfile.maxHrRunning);
		if (maxHR != null) {
			presets.push({ label: 'Z4+ HR', apply: () => setRange('heartRate', { min: Math.round(maxHR * 0.80) }) });
		} else if (athleteProfile.lthr != null) {
			const lthr = athleteProfile.lthr;
			presets.push({ label: 'Z4+ HR', apply: () => setRange('heartRate', { min: Math.round(lthr * 0.93) }) });
		}
		if (hasAltitude) {
			presets.push({ label: 'Climbing', apply: () => setRange('gradient', { min: 2 }) });
			presets.push({ label: 'Downhill', apply: () => setRange('gradient', { max: -2 }) });
		}
		return presets;
	});

	let speedMin = $state('');
	let speedMax = $state('');
	let powerMin = $state('');
	let powerMax = $state('');
	let hrMin = $state('');
	let hrMax = $state('');
	let cadenceMin = $state('');
	let cadenceMax = $state('');
	let gradientMin = $state('');
	let gradientMax = $state('');
	let inverted = $state(false);
	let expanded = $state(false);

	function parseNum(s: string): number | undefined {
		const n = parseFloat(s);
		return isNaN(n) ? undefined : n;
	}

	function setRange(channel: keyof Omit<RecordFilter, 'inverted'>, range: ChannelRange) {
		recordFilter.update(f => ({ ...f, [channel]: range }));
		if (channel === 'speed') { speedMin = range.min != null ? String(range.min) : ''; speedMax = range.max != null ? String(range.max) : ''; }
		if (channel === 'power') { powerMin = range.min != null ? String(range.min) : ''; powerMax = range.max != null ? String(range.max) : ''; }
		if (channel === 'heartRate') { hrMin = range.min != null ? String(range.min) : ''; hrMax = range.max != null ? String(range.max) : ''; }
		if (channel === 'cadence') { cadenceMin = range.min != null ? String(range.min) : ''; cadenceMax = range.max != null ? String(range.max) : ''; }
		if (channel === 'gradient') { gradientMin = range.min != null ? String(range.min) : ''; gradientMax = range.max != null ? String(range.max) : ''; }
	}

	function applyZonePreset(channel: 'power' | 'heartRate', band: { min: number; max: number }) {
		const min = Math.round(band.min) || undefined;
		const max = band.max === Infinity ? undefined : Math.round(band.max);
		setRange(channel, { min, max });
	}

	function commit() {
		recordFilter.set({
			...(speedMin !== '' || speedMax !== '' ? { speed: { min: parseNum(speedMin), max: parseNum(speedMax) } } : {}),
			...(powerMin !== '' || powerMax !== '' ? { power: { min: parseNum(powerMin), max: parseNum(powerMax) } } : {}),
			...(hrMin !== '' || hrMax !== '' ? { heartRate: { min: parseNum(hrMin), max: parseNum(hrMax) } } : {}),
			...(cadenceMin !== '' || cadenceMax !== '' ? { cadence: { min: parseNum(cadenceMin), max: parseNum(cadenceMax) } } : {}),
			...(gradientMin !== '' || gradientMax !== '' ? { gradient: { min: parseNum(gradientMin), max: parseNum(gradientMax) } } : {}),
			...(inverted ? { inverted: true } : {}),
		});
	}

	function handleClear() {
		speedMin = speedMax = powerMin = powerMax = hrMin = hrMax = cadenceMin = cadenceMax = gradientMin = gradientMax = '';
		inverted = false;
		clearAllFilters();
	}

	function handleInvert() {
		inverted = !inverted;
		recordFilter.update(f => ({ ...f, inverted: inverted || undefined }));
	}

	const hasSpeed = $derived(speedMin !== '' || speedMax !== '');
	const hasPower = $derived(powerMin !== '' || powerMax !== '');
	const hasHr = $derived(hrMin !== '' || hrMax !== '');
	const hasCadence = $derived(cadenceMin !== '' || cadenceMax !== '');
	const hasGradient = $derived(gradientMin !== '' || gradientMax !== '');

	function clickOutside(node: HTMLElement) {
		function handle(e: MouseEvent) {
			if (expanded && !node.contains(e.target as Node)) expanded = false;
		}
		document.addEventListener('click', handle, true);
		return { destroy() { document.removeEventListener('click', handle, true); } };
	}
</script>

<div class="filter-wrap" use:clickOutside>
	<button
		class="filter-toggle"
		class:filter-toggle--active={$activeFilterCount > 0}
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
		aria-controls="filter-body"
	>
		<span class="filter-toggle-label">Filter</span>
		{#if $activeFilterCount > 0}
			<span class="filter-badge" aria-label="{$activeFilterCount} active filters">{$activeFilterCount}</span>
		{/if}
		<span class="filter-chevron" class:filter-chevron--open={expanded} aria-hidden="true">›</span>
	</button>

	{#if expanded}
		<div class="filter-body" id="filter-body" role="region" aria-label="Record filter controls">
			<!-- Named presets row -->
			{#if namedPresets().length > 0}
				<div class="preset-row">
					{#each namedPresets() as preset}
						<button class="preset-btn" onclick={() => { preset.apply(); commit(); }}>
							{preset.label}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Speed -->
			<div class="filter-row" class:filter-row--active={hasSpeed}>
				<span class="filter-label">
					{#if hasSpeed}<span class="active-dot" aria-hidden="true"></span>{/if}
					{speedLabel}
				</span>
				<div class="filter-inputs">
					<input
						type="number"
						placeholder="Min"
						class="filter-input"
						bind:value={speedMin}
						oninput={commit}
						aria-label="Speed minimum"
					/>
					<span class="filter-sep">–</span>
					<input
						type="number"
						placeholder="Max"
						class="filter-input"
						bind:value={speedMax}
						oninput={commit}
						aria-label="Speed maximum"
					/>
				</div>
			</div>

			<!-- Power -->
			<div class="filter-row" class:filter-row--active={hasPower}>
				<span class="filter-label">
					{#if hasPower}<span class="active-dot" aria-hidden="true"></span>{/if}
					{powerLabel()} <span class="filter-unit">W</span>
				</span>
				<div class="filter-inputs">
					<input
						type="number"
						placeholder="Min"
						class="filter-input"
						bind:value={powerMin}
						oninput={commit}
						aria-label="Power minimum watts"
					/>
					<span class="filter-sep">–</span>
					<input
						type="number"
						placeholder="Max"
						class="filter-input"
						bind:value={powerMax}
						oninput={commit}
						aria-label="Power maximum watts"
					/>
				</div>
				{#if powerZones()}
					<div class="zone-presets" role="group" aria-label="Power zone presets">
						{#each powerZones() as band, zi}
							<button
								class="zone-btn"
								onclick={() => { applyZonePreset('power', band); commit(); }}
								aria-label={`Power zone ${zi + 1}`}
							>Z{zi + 1}</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Heart Rate -->
			<div class="filter-row" class:filter-row--active={hasHr}>
				<span class="filter-label">
					{#if hasHr}<span class="active-dot" aria-hidden="true"></span>{/if}
					Heart Rate <span class="filter-unit">bpm</span>
				</span>
				<div class="filter-inputs">
					<input
						type="number"
						placeholder="Min"
						class="filter-input"
						bind:value={hrMin}
						oninput={commit}
						aria-label="Heart rate minimum bpm"
					/>
					<span class="filter-sep">–</span>
					<input
						type="number"
						placeholder="Max"
						class="filter-input"
						bind:value={hrMax}
						oninput={commit}
						aria-label="Heart rate maximum bpm"
					/>
				</div>
				{#if hrZones()}
					<div class="zone-presets" role="group" aria-label="HR zone presets">
						{#each hrZones() as band, zi}
							<button
								class="zone-btn"
								onclick={() => { applyZonePreset('heartRate', band); commit(); }}
								aria-label={`HR zone ${zi + 1}`}
							>Z{zi + 1}</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Cadence -->
			<div class="filter-row" class:filter-row--active={hasCadence}>
				<span class="filter-label">
					{#if hasCadence}<span class="active-dot" aria-hidden="true"></span>{/if}
					Cadence <span class="filter-unit">{isRunning ? 'spm' : 'rpm'}</span>
				</span>
				<div class="filter-inputs">
					<input
						type="number"
						placeholder="Min"
						class="filter-input"
						bind:value={cadenceMin}
						oninput={commit}
						aria-label="Cadence minimum"
					/>
					<span class="filter-sep">–</span>
					<input
						type="number"
						placeholder="Max"
						class="filter-input"
						bind:value={cadenceMax}
						oninput={commit}
						aria-label="Cadence maximum"
					/>
				</div>
			</div>

			<!-- Gradient -->
			{#if hasAltitude}
				<div class="filter-row" class:filter-row--active={hasGradient}>
					<span class="filter-label">
						{#if hasGradient}<span class="active-dot" aria-hidden="true"></span>{/if}
						Gradient <span class="filter-unit">%</span>
					</span>
					<div class="filter-inputs">
						<input
							type="number"
							placeholder="Min"
							class="filter-input"
							step="0.5"
							bind:value={gradientMin}
							oninput={commit}
							aria-label="Gradient minimum percent"
						/>
						<span class="filter-sep">–</span>
						<input
							type="number"
							placeholder="Max"
							class="filter-input"
							step="0.5"
							bind:value={gradientMax}
							oninput={commit}
							aria-label="Gradient maximum percent"
						/>
					</div>
				</div>
			{/if}

			<!-- Footer -->
			<div class="filter-footer">
				<label class="invert-label">
					<input
						type="checkbox"
						class="invert-check"
						bind:checked={inverted}
						oninput={handleInvert}
					/>
					Invert filter
				</label>
				<button class="clear-btn" onclick={handleClear}>Clear all</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.filter-wrap {
		position: relative;
		display: inline-block;
	}

	.filter-toggle {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		font-size: 0.6875rem;
		font-weight: 500;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s, color 0.12s;
		white-space: nowrap;
		height: 28px;
	}

	.filter-toggle:hover {
		background: color-mix(in srgb, var(--color-border) 40%, transparent);
		color: var(--color-text);
	}

	.filter-toggle--active {
		border-color: #38bdf8;
		color: #38bdf8;
	}

	.filter-toggle-label {
		font-size: 0.6875rem;
	}

	.filter-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		font-size: 0.625rem;
		font-weight: 700;
		border-radius: 9999px;
		background: #38bdf8;
		color: #000;
		line-height: 1;
	}

	.filter-chevron {
		font-size: 0.75rem;
		line-height: 1;
		transform: rotate(90deg);
		transition: transform 0.15s ease;
		opacity: 0.7;
	}

	.filter-chevron--open {
		transform: rotate(-90deg);
	}

	.filter-body {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 200;
		min-width: 260px;
		max-height: 340px;
		overflow-y: auto;
		background: var(--color-card, var(--color-sidebar));
		border: 1px solid var(--color-border);
		border-radius: 6px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 12px;
	}

	.preset-row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--color-border);
		margin-bottom: 2px;
	}

	.preset-btn {
		padding: 2px 8px;
		font-size: 0.6875rem;
		border-radius: 9999px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s;
		white-space: nowrap;
	}

	.preset-btn:hover {
		background: color-mix(in srgb, var(--color-border) 60%, transparent);
		border-color: #38bdf8;
		color: #38bdf8;
	}

	.filter-row {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 4px 0;
	}

	.filter-row--active .filter-label {
		color: #38bdf8;
	}

	.filter-label {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		transition: color 0.12s;
	}

	.active-dot {
		display: inline-block;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #38bdf8;
		flex-shrink: 0;
	}

	.filter-unit {
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		opacity: 0.75;
	}

	.filter-inputs {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.filter-input {
		width: 64px;
		padding: 3px 6px;
		font-size: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-bg);
		color: var(--color-text);
		outline: none;
		transition: border-color 0.12s;
		-moz-appearance: textfield;
	}

	.filter-input::-webkit-outer-spin-button,
	.filter-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.filter-input:focus {
		border-color: #38bdf8;
	}

	.filter-sep {
		font-size: 0.6875rem;
		color: var(--color-muted);
		flex-shrink: 0;
	}

	.zone-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		margin-top: 1px;
	}

	.zone-btn {
		padding: 1px 6px;
		font-size: 0.625rem;
		font-weight: 600;
		border-radius: 9999px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s, color 0.12s;
	}

	.zone-btn:hover {
		background: color-mix(in srgb, var(--color-border) 60%, transparent);
		border-color: #38bdf8;
		color: #38bdf8;
	}

	.filter-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 6px;
		margin-top: 2px;
		border-top: 1px solid var(--color-border);
	}

	.invert-label {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.6875rem;
		color: var(--color-muted);
		cursor: pointer;
		user-select: none;
	}

	.invert-check {
		width: 12px;
		height: 12px;
		cursor: pointer;
		accent-color: #38bdf8;
	}

	.clear-btn {
		padding: 3px 10px;
		font-size: 0.6875rem;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		transition: background 0.12s, color 0.12s;
	}

	.clear-btn:hover {
		background: color-mix(in srgb, var(--color-border) 60%, transparent);
		color: var(--color-text);
	}
</style>
