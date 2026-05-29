import type { Activity } from '$lib/types';

/**
 * Reactive composable for indoor/mixed-session warning state.
 *
 * Encapsulates derived detection and dismissal state shared between
 * the Compare and Event pages.
 *
 * Usage:
 *   const indoor = createIndoorWarnings(() => $activities);
 *   // read: indoor.hasMixedIndoorOutdoor, indoor.allIndoor
 *   // dismiss: indoor.mixedWarningDismissed = true
 */
export function createIndoorWarnings(getActivities: () => Activity[]) {
	/** True when the loaded set contains both indoor and outdoor activities. */
	const hasMixedIndoorOutdoor = $derived(
		getActivities().length > 1 &&
		getActivities().some(a => a.isIndoor) &&
		getActivities().some(a => !a.isIndoor)
	);

	/** True when all loaded files are indoor activities (requires 2+ files). */
	const allIndoor = $derived(
		getActivities().length > 1 &&
		getActivities().every(a => a.isIndoor)
	);

	let mixedWarningDismissed = $state(false);
	let indoorInfoDismissed   = $state(false);

	// Reset dismissals whenever the file set changes.
	$effect(() => {
		void getActivities();
		mixedWarningDismissed = false;
		indoorInfoDismissed   = false;
	});

	return {
		get hasMixedIndoorOutdoor() { return hasMixedIndoorOutdoor; },
		get allIndoor()              { return allIndoor; },
		get mixedWarningDismissed()  { return mixedWarningDismissed; },
		set mixedWarningDismissed(v: boolean) { mixedWarningDismissed = v; },
		get indoorInfoDismissed()    { return indoorInfoDismissed; },
		set indoorInfoDismissed(v: boolean)   { indoorInfoDismissed = v; },
	};
}
