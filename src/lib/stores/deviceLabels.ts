import type { Device } from '$lib/types';

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

const STORAGE_KEY = 'analyser-device-labels';

// In-memory cache; populated lazily on first access and kept in sync with
// every write so repeated reads within a session never hit localStorage again.
let _cache: Map<number, string> | null = null;

function getCache(): Map<number, string> {
	if (_cache !== null) return _cache;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		_cache = raw ? new Map(JSON.parse(raw) as [number, string][]) : new Map();
	} catch {
		_cache = new Map();
	}
	return _cache;
}

function saveLabels(map: Map<number, string>): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.entries())));
	} catch {
		// localStorage may be unavailable in some environments (SSR, private browsing)
	}
}

/** Get the stored label for a device by its ANT+ device number. */
export function getDeviceLabel(antDeviceNumber: number): string | undefined {
	return getCache().get(antDeviceNumber);
}

/** Persist a user-assigned label for a device by its ANT+ device number. */
export function setDeviceLabel(antDeviceNumber: number, label: string): void {
	const map = getCache();
	map.set(antDeviceNumber, label.trim());
	saveLabels(map);
}

/** Remove a stored label for a device, reverting to manufacturer/product fallback. */
export function removeDeviceLabel(antDeviceNumber: number): void {
	const map = getCache();
	map.delete(antDeviceNumber);
	saveLabels(map);
}

/**
 * Apply stored labels to an array of devices in-place.
 * Only devices with a known antDeviceNumber are checked.
 */
export function applyLabels(devices: Device[]): void {
	const map = getCache();
	for (const device of devices) {
		if (device.antDeviceNumber != null) {
			const stored = map.get(device.antDeviceNumber);
			if (stored) device.label = stored;
		}
	}
}
