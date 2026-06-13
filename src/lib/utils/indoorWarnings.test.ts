import { describe, it, expect } from 'vitest';
import { createIndoorWarnings } from './indoorWarnings.svelte.ts';
import type { Activity } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';

function makeActivity(isIndoor: boolean): Activity {
	return makeBaseActivity({ isIndoor });
}

// ---- allIndoor ----

describe('createIndoorWarnings — allIndoor', () => {
	it('allIndoor_emptyActivities_returnsFalse', () => {
		const indoor = createIndoorWarnings(() => []);
		expect(indoor.allIndoor).toBe(false);
	});

	it('allIndoor_singleIndoorActivity_returnsTrue', () => {
		const indoor = createIndoorWarnings(() => [makeActivity(true)]);
		expect(indoor.allIndoor).toBe(true);
	});

	it('allIndoor_multipleIndoorActivities_returnsTrue', () => {
		const indoor = createIndoorWarnings(() => [makeActivity(true), makeActivity(true)]);
		expect(indoor.allIndoor).toBe(true);
	});

	it('allIndoor_singleOutdoorActivity_returnsFalse', () => {
		const indoor = createIndoorWarnings(() => [makeActivity(false)]);
		expect(indoor.allIndoor).toBe(false);
	});

	it('allIndoor_mixedIndoorAndOutdoor_returnsFalse', () => {
		const indoor = createIndoorWarnings(() => [makeActivity(true), makeActivity(false)]);
		expect(indoor.allIndoor).toBe(false);
	});

	it('allIndoor_multipleOutdoorActivities_returnsFalse', () => {
		const indoor = createIndoorWarnings(() => [makeActivity(false), makeActivity(false)]);
		expect(indoor.allIndoor).toBe(false);
	});
});

// ---- hasMixedIndoorOutdoor ----

describe('createIndoorWarnings — hasMixedIndoorOutdoor', () => {
	it('hasMixedIndoorOutdoor_emptyActivities_returnsFalse', () => {
		const indoor = createIndoorWarnings(() => []);
		expect(indoor.hasMixedIndoorOutdoor).toBe(false);
	});

	it('hasMixedIndoorOutdoor_singleIndoorActivity_returnsFalse', () => {
		const indoor = createIndoorWarnings(() => [makeActivity(true)]);
		expect(indoor.hasMixedIndoorOutdoor).toBe(false);
	});

	it('hasMixedIndoorOutdoor_mixedActivities_returnsTrue', () => {
		const indoor = createIndoorWarnings(() => [makeActivity(true), makeActivity(false)]);
		expect(indoor.hasMixedIndoorOutdoor).toBe(true);
	});

	it('hasMixedIndoorOutdoor_allIndoor_returnsFalse', () => {
		const indoor = createIndoorWarnings(() => [makeActivity(true), makeActivity(true)]);
		expect(indoor.hasMixedIndoorOutdoor).toBe(false);
	});

	it('hasMixedIndoorOutdoor_allOutdoor_returnsFalse', () => {
		const indoor = createIndoorWarnings(() => [makeActivity(false), makeActivity(false)]);
		expect(indoor.hasMixedIndoorOutdoor).toBe(false);
	});
});
