import type { Device } from '$lib/types';

const STORAGE_KEY = 'analyser-device-labels';

// In-memory cache; populated lazily on first access and kept in sync with
// every write so repeated reads within a session never hit localStorage again.
let _cache: Map<string, string> | null = null;

/**
 * Derive a stable localStorage key for a device.
 * Priority: antDeviceNumber → serialNumber → manufacturer:product → null (unkeyable)
 * Keys are namespaced to prevent collisions between different identifier types.
 */
export function deviceStorageKey(device: Device): string | null {
	if (device.antDeviceNumber != null) return `ant:${device.antDeviceNumber}`;
	if (device.serialNumber != null)    return `serial:${device.serialNumber}`;
	const m = device.manufacturer?.trim();
	const p = device.product?.trim();
	if (m || p) return `device:${m ?? ''}:${p ?? ''}`;
	return null;
}

function getCache(): Map<string, string> {
	if (_cache !== null) return _cache;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			_cache = new Map();
			return _cache;
		}
		// Parse entries — keys may be numeric (old format) or string (current format).
		const entries = JSON.parse(raw) as [number | string, string][];
		let needsMigration = false;
		const migrated: [string, string][] = entries.map(([k, v]) => {
			if (typeof k === 'number') {
				needsMigration = true;
				return [`ant:${k}`, v];
			}
			return [k, v];
		});
		_cache = new Map(migrated);
		if (needsMigration) {
			// Save back in the new format so migration only happens once.
			saveLabels(_cache);
		}
	} catch {
		_cache = new Map();
	}
	return _cache;
}

function saveLabels(map: Map<string, string>): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.entries())));
	} catch {
		// localStorage may be unavailable in some environments (SSR, private browsing)
	}
}

/** Get the stored label for a device by its storage key. */
export function getDeviceLabel(key: string): string | undefined {
	return getCache().get(key);
}

/** Persist a user-assigned label for a device by its storage key. */
export function setDeviceLabel(key: string, label: string): void {
	const map = getCache();
	map.set(key, label.trim());
	saveLabels(map);
}

/** Remove a stored label for a device, reverting to manufacturer/product fallback. */
export function removeDeviceLabel(key: string): void {
	const map = getCache();
	map.delete(key);
	saveLabels(map);
}

/**
 * Apply stored labels to an array of devices in-place.
 * Works for all device types — ANT+, BLE, local — by deriving the storage key
 * from whatever identifying fields are available.
 */
export function applyLabels(devices: Device[]): void {
	const map = getCache();
	for (const device of devices) {
		const key = deviceStorageKey(device);
		if (key != null) {
			const stored = map.get(key);
			if (stored) device.label = stored;
		}
	}
}
