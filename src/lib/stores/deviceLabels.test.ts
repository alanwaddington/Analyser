import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Device } from '$lib/types';
import type { LabelEdit } from './deviceLabels';

vi.mock('./toast', () => ({ addToast: vi.fn() }));

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
let applyLabels: (devices: Device[]) => Device[];
let resolveLabel: (device: Device) => string | undefined;
let getAllLabels: () => Record<string, string>;
let replaceAllLabels: (labels: Record<string, string>) => void;
let setOnLabelChange: (callback: () => void) => void;
let recordEdit: (key: string, from: string, to: string) => void;
let undoLabelEdit: () => void;
let redoLabelEdit: () => void;
let getEditHistory: (deviceKey?: string) => LabelEdit[];
let canUndo: () => boolean;
let canRedo: () => boolean;
let clearEditHistory: () => void;
let addToastMock: ReturnType<typeof vi.fn>;

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
	resolveLabel = mod.resolveLabel;
	getAllLabels = mod.getAllLabels;
	replaceAllLabels = mod.replaceAllLabels;
	setOnLabelChange = mod.setOnLabelChange;
	recordEdit = mod.recordEdit;
	undoLabelEdit = mod.undoLabelEdit;
	redoLabelEdit = mod.redoLabelEdit;
	getEditHistory = mod.getEditHistory;
	canUndo = mod.canUndo;
	canRedo = mod.canRedo;
	clearEditHistory = mod.clearEditHistory;
	const toastMod = await import('./toast.ts');
	addToastMock = vi.mocked(toastMod.addToast);
	addToastMock.mockClear();
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
		const devices: Device[] = [{ deviceIndex: 0, serialNumber: 1 }];
		const result = applyLabels(devices);
		expect(result[0].label).toBeUndefined(); // empty string is falsy — not applied
	});
});

// ---------------------------------------------------------------------------
// applyLabels
// ---------------------------------------------------------------------------

describe('applyLabels', () => {
	it('applyLabels_antDevice_labelsRestored', () => {
		setDeviceLabel('ant:42', 'My HRM');
		const devices = [makeDevice({ antDeviceNumber: 42 })];
		const result = applyLabels(devices);
		expect(result[0].label).toBe('My HRM');
	});

	it('applyLabels_serialDevice_labelsRestored', () => {
		setDeviceLabel('serial:999', 'My Watch');
		const devices = [makeDevice({ serialNumber: 999 })];
		const result = applyLabels(devices);
		expect(result[0].label).toBe('My Watch');
	});

	it('applyLabels_manufacturerProductDevice_labelsRestored', () => {
		setDeviceLabel('device:stryd:duo', 'My Stryd');
		const devices = [makeDevice({ manufacturer: 'stryd', product: 'duo' })];
		const result = applyLabels(devices);
		expect(result[0].label).toBe('My Stryd');
	});

	it('applyLabels_antDeviceTypeOnlyDevice_labelsRestored', () => {
		// A bare ANT+ HRM with no serial/manufacturer/device-number — keyed by type
		setDeviceLabel('type:120', 'Polar H10');
		const devices = [makeDevice({ antDeviceType: 120 })];
		const result = applyLabels(devices);
		expect(result[0].label).toBe('Polar H10');
	});

	it('applyLabels_unkeyableDevice_labelUntouched', () => {
		const devices = [makeDevice({ deviceIndex: 0 })];
		const result = applyLabels(devices);
		expect(result[0].label).toBeUndefined();
	});

	it('applyLabels_withLabel_doesNotMutateOriginal', () => {
		setDeviceLabel('ant:42', 'My HRM');
		const device = makeDevice({ antDeviceNumber: 42 });
		applyLabels([device]);
		expect(device.label).toBeUndefined(); // original untouched
	});

	it('applyLabels_noLabel_returnsSameReference', () => {
		const device = makeDevice({ deviceIndex: 0 });
		const result = applyLabels([device]);
		expect(result[0]).toBe(device); // no label → no copy
	});

	it('applyLabels_withLabel_returnsDifferentReference', () => {
		setDeviceLabel('ant:42', 'My HRM');
		const device = makeDevice({ antDeviceNumber: 42 });
		const result = applyLabels([device]);
		expect(result[0]).not.toBe(device); // label applied → new object
	});
});

// ---------------------------------------------------------------------------
// resolveLabel
// ---------------------------------------------------------------------------

describe('resolveLabel', () => {
	it('resolveLabel_knownKey_returnsStoredLabel', () => {
		setDeviceLabel('ant:42', 'My HRM');
		const device = makeDevice({ antDeviceNumber: 42 });
		expect(resolveLabel(device)).toBe('My HRM');
	});

	it('resolveLabel_unknownKey_returnsUndefined', () => {
		const device = makeDevice({ antDeviceNumber: 99 });
		expect(resolveLabel(device)).toBeUndefined();
	});

	it('resolveLabel_unkeyableDevice_returnsUndefined', () => {
		const device = makeDevice({ deviceIndex: 0 });
		expect(resolveLabel(device)).toBeUndefined();
	});

	it('resolveLabel_emptyStringStored_returnsUndefined', () => {
		setDeviceLabel('ant:42', '');
		const device = makeDevice({ antDeviceNumber: 42 });
		expect(resolveLabel(device)).toBeUndefined(); // empty string is falsy
	});
});

// ---------------------------------------------------------------------------
// getAllLabels / replaceAllLabels
// ---------------------------------------------------------------------------

describe('getAllLabels', () => {
	it('getAllLabels_emptyStore_returnsEmptyObject', () => {
		expect(getAllLabels()).toEqual({});
	});

	it('getAllLabels_populatedStore_returnsAllLabels', () => {
		setDeviceLabel('ant:42', 'Polar H10');
		setDeviceLabel('serial:999', 'Garmin Fenix');
		const result = getAllLabels();
		expect(result).toEqual({ 'ant:42': 'Polar H10', 'serial:999': 'Garmin Fenix' });
	});
});

describe('replaceAllLabels', () => {
	it('replaceAllLabels_replacesExistingLabels', () => {
		setDeviceLabel('ant:42', 'Old Name');
		replaceAllLabels({ 'serial:999': 'New Watch', 'ant:100': 'New HRM' });
		expect(getDeviceLabel('ant:42')).toBeUndefined();
		expect(getDeviceLabel('serial:999')).toBe('New Watch');
		expect(getDeviceLabel('ant:100')).toBe('New HRM');
	});

	it('replaceAllLabels_persistsToLocalStorage', () => {
		replaceAllLabels({ 'ant:42': 'Polar H10' });
		const saved = localStorageMock.getItem('analyser-device-labels');
		expect(saved).toContain('ant:42');
		expect(saved).toContain('Polar H10');
	});

	it('replaceAllLabels_emptyObject_clearsAllLabels', () => {
		setDeviceLabel('ant:42', 'Polar H10');
		replaceAllLabels({});
		expect(getDeviceLabel('ant:42')).toBeUndefined();
		expect(getAllLabels()).toEqual({});
	});

	it('replaceAllLabels_doesNotTriggerOnLabelChange', () => {
		const callback = vi.fn();
		setOnLabelChange(callback);
		replaceAllLabels({ 'ant:42': 'Polar H10' });
		expect(callback).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// setOnLabelChange hook
// ---------------------------------------------------------------------------

describe('setOnLabelChange', () => {
	it('setOnLabelChange_callbackInvokedOnSetDeviceLabel', () => {
		const callback = vi.fn();
		setOnLabelChange(callback);
		setDeviceLabel('ant:42', 'My HRM');
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('setOnLabelChange_callbackInvokedOnRemoveDeviceLabel', () => {
		const callback = vi.fn();
		setOnLabelChange(callback);
		removeDeviceLabel('ant:42');
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('setOnLabelChange_noCallbackSet_setDeviceLabelDoesNotThrow', () => {
		// Default state: no callback registered — must not throw
		expect(() => setDeviceLabel('ant:42', 'My HRM')).not.toThrow();
	});

	it('setOnLabelChange_callbackCalledAfterWrite', () => {
		let labelAtCallbackTime: string | undefined;
		setOnLabelChange(() => {
			labelAtCallbackTime = getDeviceLabel('ant:42');
		});
		setDeviceLabel('ant:42', 'My HRM');
		expect(labelAtCallbackTime).toBe('My HRM');
	});
});

// ---------------------------------------------------------------------------
// recordEdit
// ---------------------------------------------------------------------------

describe('recordEdit', () => {
	it('recordEdit_basicEdit_addsToHistory', () => {
		recordEdit('ant:42', '', 'Polar H10');
		const history = getEditHistory();
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({ deviceKey: 'ant:42', from: '', to: 'Polar H10' });
	});

	it('recordEdit_storesTimestamp', () => {
		const before = Date.now();
		recordEdit('ant:42', '', 'Polar H10');
		const after = Date.now();
		const ts = getEditHistory()[0].timestamp;
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});

	it('recordEdit_afterRecord_canUndo', () => {
		recordEdit('ant:42', '', 'Polar H10');
		expect(canUndo()).toBe(true);
	});

	it('recordEdit_clearsRedoStack', () => {
		recordEdit('ant:42', '', 'First');
		undoLabelEdit();
		expect(canRedo()).toBe(true);
		recordEdit('ant:42', '', 'Second');
		expect(canRedo()).toBe(false);
	});

	it('recordEdit_exceedsMaxHistory_dropsOldest', () => {
		for (let i = 0; i < 21; i++) {
			recordEdit('ant:42', String(i), String(i + 1));
		}
		const history = getEditHistory();
		expect(history.length).toBe(20);
		expect(history[0].from).toBe('1'); // edit 0 (from='0') was shifted off
	});
});

// ---------------------------------------------------------------------------
// canUndo / canRedo
// ---------------------------------------------------------------------------

describe('canUndo / canRedo', () => {
	it('canUndo_emptyHistory_returnsFalse', () => {
		expect(canUndo()).toBe(false);
	});

	it('canUndo_nonEmptyHistory_returnsTrue', () => {
		recordEdit('ant:42', '', 'Polar H10');
		expect(canUndo()).toBe(true);
	});

	it('canRedo_emptyRedoStack_returnsFalse', () => {
		expect(canRedo()).toBe(false);
	});

	it('canRedo_nonEmptyRedoStack_returnsTrue', () => {
		recordEdit('ant:42', '', 'Polar H10');
		undoLabelEdit();
		expect(canRedo()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// undoLabelEdit
// ---------------------------------------------------------------------------

describe('undoLabelEdit', () => {
	it('undoLabelEdit_emptyHistory_doesNothing', () => {
		expect(() => undoLabelEdit()).not.toThrow();
		expect(addToastMock).not.toHaveBeenCalled();
	});

	it('undoLabelEdit_nonEmptyHistory_restoresFromLabel', () => {
		setDeviceLabel('ant:42', 'Polar H10');
		recordEdit('ant:42', '', 'Polar H10');
		undoLabelEdit();
		expect(getDeviceLabel('ant:42')).toBeUndefined();
	});

	it('undoLabelEdit_fromIsNonEmpty_setsFromLabel', () => {
		setDeviceLabel('ant:42', 'New Name');
		recordEdit('ant:42', 'Old Name', 'New Name');
		undoLabelEdit();
		expect(getDeviceLabel('ant:42')).toBe('Old Name');
	});

	it('undoLabelEdit_fromIsEmpty_removesLabel', () => {
		setDeviceLabel('ant:42', 'Polar H10');
		recordEdit('ant:42', '', 'Polar H10');
		undoLabelEdit();
		expect(getDeviceLabel('ant:42')).toBeUndefined();
	});

	it('undoLabelEdit_firesAddToast', () => {
		recordEdit('ant:42', '', 'Polar H10');
		undoLabelEdit();
		expect(addToastMock).toHaveBeenCalledTimes(1);
	});

	it('undoLabelEdit_movesEditToRedoStack', () => {
		recordEdit('ant:42', '', 'Polar H10');
		undoLabelEdit();
		expect(canUndo()).toBe(false);
		expect(canRedo()).toBe(true);
	});

	it('undoLabelEdit_multipleEdits_undoesInOrder', () => {
		setDeviceLabel('ant:42', 'First');
		recordEdit('ant:42', '', 'First');
		setDeviceLabel('ant:42', 'Second');
		recordEdit('ant:42', 'First', 'Second');
		undoLabelEdit();
		expect(getDeviceLabel('ant:42')).toBe('First');
		undoLabelEdit();
		expect(getDeviceLabel('ant:42')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// redoLabelEdit
// ---------------------------------------------------------------------------

describe('redoLabelEdit', () => {
	it('redoLabelEdit_emptyRedoStack_doesNothing', () => {
		expect(() => redoLabelEdit()).not.toThrow();
	});

	it('redoLabelEdit_nonEmptyRedoStack_restoresToLabel', () => {
		recordEdit('ant:42', '', 'Polar H10');
		undoLabelEdit();
		redoLabelEdit();
		expect(getDeviceLabel('ant:42')).toBe('Polar H10');
	});

	it('redoLabelEdit_toIsEmpty_removesLabel', () => {
		setDeviceLabel('ant:42', 'Polar H10');
		recordEdit('ant:42', 'Polar H10', '');
		undoLabelEdit();
		expect(getDeviceLabel('ant:42')).toBe('Polar H10');
		redoLabelEdit();
		expect(getDeviceLabel('ant:42')).toBeUndefined();
	});

	it('redoLabelEdit_movesEditBackToHistory', () => {
		recordEdit('ant:42', '', 'Polar H10');
		undoLabelEdit();
		redoLabelEdit();
		expect(canRedo()).toBe(false);
		expect(canUndo()).toBe(true);
	});

	it('redoLabelEdit_multipleUndos_redoesInOrder', () => {
		recordEdit('ant:42', '', 'First');
		setDeviceLabel('ant:42', 'First');
		recordEdit('ant:42', 'First', 'Second');
		setDeviceLabel('ant:42', 'Second');
		undoLabelEdit();
		undoLabelEdit();
		redoLabelEdit();
		expect(getDeviceLabel('ant:42')).toBe('First');
		redoLabelEdit();
		expect(getDeviceLabel('ant:42')).toBe('Second');
	});
});

// ---------------------------------------------------------------------------
// getEditHistory
// ---------------------------------------------------------------------------

describe('getEditHistory', () => {
	it('getEditHistory_noEdits_returnsEmpty', () => {
		expect(getEditHistory()).toEqual([]);
	});

	it('getEditHistory_noFilter_returnsAllHistory', () => {
		recordEdit('ant:42', '', 'HRM');
		recordEdit('serial:999', '', 'Watch');
		expect(getEditHistory()).toHaveLength(2);
	});

	it('getEditHistory_withKey_returnsOnlyMatchingEdits', () => {
		recordEdit('ant:42', '', 'HRM');
		recordEdit('serial:999', '', 'Watch');
		const filtered = getEditHistory('ant:42');
		expect(filtered).toHaveLength(1);
		expect(filtered[0].deviceKey).toBe('ant:42');
	});

	it('getEditHistory_withKey_limitsToFive', () => {
		for (let i = 0; i < 8; i++) {
			recordEdit('ant:42', String(i), String(i + 1));
		}
		expect(getEditHistory('ant:42')).toHaveLength(5);
	});

	it('getEditHistory_withKey_returnsNewestFirst', () => {
		recordEdit('ant:42', '', 'First');
		recordEdit('ant:42', 'First', 'Second');
		const history = getEditHistory('ant:42');
		expect(history[0].to).toBe('Second');
		expect(history[1].to).toBe('First');
	});

	it('getEditHistory_unknownKey_returnsEmpty', () => {
		recordEdit('ant:42', '', 'HRM');
		expect(getEditHistory('serial:999')).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// clearEditHistory
// ---------------------------------------------------------------------------

describe('clearEditHistory', () => {
	it('clearEditHistory_clearsHistory', () => {
		recordEdit('ant:42', '', 'HRM');
		clearEditHistory();
		expect(getEditHistory()).toHaveLength(0);
	});

	it('clearEditHistory_clearsRedoStack', () => {
		recordEdit('ant:42', '', 'HRM');
		undoLabelEdit();
		clearEditHistory();
		expect(canRedo()).toBe(false);
	});

	it('clearEditHistory_afterClear_cannotUndo', () => {
		recordEdit('ant:42', '', 'HRM');
		clearEditHistory();
		expect(canUndo()).toBe(false);
	});
});

describe('canUndoFor', () => {
	let canUndoFor: typeof import('./deviceLabels').canUndoFor;

	beforeEach(async () => {
		vi.resetModules();
		const mod = await import('./deviceLabels');
		({ canUndoFor } = mod);
		// also pull these for setup
		({ recordEdit, undoLabelEdit } = mod);
	});

	it('canUndoFor_noHistory_returnsFalse', () => {
		expect(canUndoFor('ant:42')).toBe(false);
	});

	it('canUndoFor_mostRecentEditMatchesKey_returnsTrue', () => {
		recordEdit('ant:42', '', 'HRM');
		expect(canUndoFor('ant:42')).toBe(true);
	});

	it('canUndoFor_mostRecentEditDifferentKey_returnsFalse', () => {
		recordEdit('ant:42', '', 'HRM');
		recordEdit('ant:11', '', 'Power');
		expect(canUndoFor('ant:42')).toBe(false);
	});

	it('canUndoFor_mostRecentEditDifferentKey_trueForThatKey', () => {
		recordEdit('ant:42', '', 'HRM');
		recordEdit('ant:11', '', 'Power');
		expect(canUndoFor('ant:11')).toBe(true);
	});

	it('canUndoFor_afterUndoMovesToPreviousDevice', () => {
		recordEdit('ant:42', '', 'HRM');
		recordEdit('ant:11', '', 'Power');
		undoLabelEdit();
		expect(canUndoFor('ant:42')).toBe(true);
		expect(canUndoFor('ant:11')).toBe(false);
	});
});
