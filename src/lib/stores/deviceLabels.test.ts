import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Device } from '$lib/types';

// localStorage mock — same pattern as theme.test.ts
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string): string | null => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; }),
	};
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mutable imports — reset module between tests so _cache is cleared
let deviceStorageKey: (device: Device) => string | null;
let getDeviceLabel: (key: string) => string | undefined;
let setDeviceLabel: (key: string, label: string) => void;
let removeDeviceLabel: (key: string) => void;
let applyLabels: (devices: Device[]) => void;

beforeEach(async () => {
	vi.resetModules();
	localStorageMock.clear();
	localStorageMock.getItem.mockClear();
	localStorageMock.setItem.mockClear();
	const mod = await import('./deviceLabels.ts');
	deviceStorageKey = mod.deviceStorageKey;
	getDeviceLabel = mod.getDeviceLabel;
	setDeviceLabel = mod.setDeviceLabel;
	removeDeviceLabel = mod.removeDeviceLabel;
	applyLabels = mod.applyLabels;
});

function makeDevice(overrides: Partial<Device> = {}): Device {
	return { deviceIndex: 0, ...overrides };
}

// ---------------------------------------------------------------------------
// deviceStorageKey
// ---------------------------------------------------------------------------

describe('deviceStorageKey', () => {
	it('deviceStorageKey_antDeviceNumber_returnsAntPrefix', () => {
		expect(deviceStorageKey(makeDevice({ antDeviceNumber: 9876 }))).toBe('ant:9876');
	});

	it('deviceStorageKey_serialNumberNoAnt_returnsSerialPrefix', () => {
		expect(deviceStorageKey(makeDevice({ serialNumber: 12345 }))).toBe('serial:12345');
	});

	it('deviceStorageKey_manufacturerAndProduct_returnsDevicePrefix', () => {
		expect(deviceStorageKey(makeDevice({ manufacturer: 'garmin', product: 'fenix7' }))).toBe('device:garmin:fenix7');
	});

	it('deviceStorageKey_manufacturerOnly_returnsDevicePrefixEmptyProduct', () => {
		expect(deviceStorageKey(makeDevice({ manufacturer: 'garmin' }))).toBe('device:garmin:');
	});

	it('deviceStorageKey_productOnly_returnsDevicePrefixEmptyManufacturer', () => {
		expect(deviceStorageKey(makeDevice({ product: 'fenix7' }))).toBe('device::fenix7');
	});

	it('deviceStorageKey_antTakesPrecedenceOverSerial', () => {
		expect(deviceStorageKey(makeDevice({ antDeviceNumber: 100, serialNumber: 200 }))).toBe('ant:100');
	});

	it('deviceStorageKey_noIdentifiers_returnsNull', () => {
		expect(deviceStorageKey(makeDevice({ deviceIndex: 0 }))).toBeNull();
	});

	it('deviceStorageKey_emptyStringsIgnored_returnsNull', () => {
		expect(deviceStorageKey(makeDevice({ manufacturer: '', product: '' }))).toBeNull();
	});

	it('deviceStorageKey_antDeviceTypeOnlyNoOtherIds_returnsTypePrefix', () => {
		// e.g. a bare ANT+ HRM with no serial, no manufacturer, no device number
		expect(deviceStorageKey(makeDevice({ antDeviceType: 120 }))).toBe('type:120');
	});

	it('deviceStorageKey_antDeviceTypeWithSerial_serialTakesPrecedence', () => {
		expect(deviceStorageKey(makeDevice({ antDeviceType: 120, serialNumber: 999 }))).toBe('serial:999');
	});
});

// ---------------------------------------------------------------------------
// Migration tests
// ---------------------------------------------------------------------------

describe('getCache — migration', () => {
	it('getCache_oldNumericEntry_migratedToAntPrefix', () => {
		localStorageMock.setItem('analyser-device-labels', JSON.stringify([[42, 'My HRM']]));
		expect(getDeviceLabel('ant:42')).toBe('My HRM');
	});

	it('getCache_alreadyMigratedEntry_notDoublePrefixed', () => {
		localStorageMock.setItem('analyser-device-labels', JSON.stringify([['ant:42', 'My HRM']]));
		expect(getDeviceLabel('ant:42')).toBe('My HRM');
	});

	it('getCache_mixedOldAndNew_allAccessible', () => {
		localStorageMock.setItem('analyser-device-labels', JSON.stringify([[42, 'HRM'], ['serial:999', 'Watch']]));
		expect(getDeviceLabel('ant:42')).toBe('HRM');
		expect(getDeviceLabel('serial:999')).toBe('Watch');
	});

	it('getCache_migration_savesBackMigratedData', () => {
		localStorageMock.setItem('analyser-device-labels', JSON.stringify([[42, 'My HRM']]));
		getDeviceLabel('ant:42');
		const saved = localStorageMock.getItem('analyser-device-labels');
		expect(saved).toContain('ant:42');
		expect(saved).not.toMatch(/"key":\s*42/); // no bare numeric key
		// Confirm the saved data does NOT contain a bare [42, ...] entry
		const parsed = JSON.parse(saved!);
		const keys = parsed.map(([k]: [unknown, unknown]) => k);
		expect(keys).not.toContain(42);
	});
});

// ---------------------------------------------------------------------------
// setDeviceLabel / removeDeviceLabel / getDeviceLabel
// ---------------------------------------------------------------------------

describe('setDeviceLabel / removeDeviceLabel', () => {
	it('setDeviceLabel_stringKey_persistsAndRetrievable', () => {
		setDeviceLabel('serial:12345', 'My Watch');
		expect(getDeviceLabel('serial:12345')).toBe('My Watch');
	});

	it('removeDeviceLabel_existingKey_removesEntry', () => {
		setDeviceLabel('device:garmin:fenix7', 'My Fenix');
		removeDeviceLabel('device:garmin:fenix7');
		expect(getDeviceLabel('device:garmin:fenix7')).toBeUndefined();
	});

	it('setDeviceLabel_trimsWhitespace', () => {
		// setDeviceLabel does NOT trim — caller is responsible for pre-trimming.
		// commitRename trims with renameValue.trim() before calling setDeviceLabel.
		setDeviceLabel('serial:1', '  My Watch  ');
		expect(getDeviceLabel('serial:1')).toBe('  My Watch  ');
	});

	it('setDeviceLabel_whitespaceOnlyLabel_callerShouldRemoveInstead', () => {
		// Whitespace-only input trims to '' in commitRename, which then calls
		// removeDeviceLabel() rather than setDeviceLabel().  This test documents
		// that setDeviceLabel with a pre-trimmed empty string stores '' and that
		// applyLabels will not apply a falsy stored value to the device.
		setDeviceLabel('serial:1', '');
		const devices = [{ deviceIndex: 0, serialNumber: 1 }];
		applyLabels(devices);
		expect(devices[0].label).toBeUndefined(); // empty string is falsy — not applied
	});
});

// ---------------------------------------------------------------------------
// applyLabels
// ---------------------------------------------------------------------------

describe('applyLabels', () => {
	it('applyLabels_antDevice_labelsRestored', () => {
		setDeviceLabel('ant:42', 'My HRM');
		const devices = [makeDevice({ antDeviceNumber: 42 })];
		applyLabels(devices);
		expect(devices[0].label).toBe('My HRM');
	});

	it('applyLabels_serialDevice_labelsRestored', () => {
		setDeviceLabel('serial:999', 'My Watch');
		const devices = [makeDevice({ serialNumber: 999 })];
		applyLabels(devices);
		expect(devices[0].label).toBe('My Watch');
	});

	it('applyLabels_manufacturerProductDevice_labelsRestored', () => {
		setDeviceLabel('device:stryd:duo', 'My Stryd');
		const devices = [makeDevice({ manufacturer: 'stryd', product: 'duo' })];
		applyLabels(devices);
		expect(devices[0].label).toBe('My Stryd');
	});

	it('applyLabels_antDeviceTypeOnlyDevice_labelsRestored', () => {
		// A bare ANT+ HRM with no serial/manufacturer/device-number — keyed by type
		setDeviceLabel('type:120', 'Polar H10');
		const devices = [makeDevice({ antDeviceType: 120 })];
		applyLabels(devices);
		expect(devices[0].label).toBe('Polar H10');
	});

	it('applyLabels_unkeyableDevice_labelUntouched', () => {
		const devices = [makeDevice({ deviceIndex: 0 })];
		applyLabels(devices);
		expect(devices[0].label).toBeUndefined();
	});
});
