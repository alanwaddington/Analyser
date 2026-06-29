import type { Device } from '../types';

/**
 * Derive a stable key for a device — used for label storage and lookup.
 * Priority: antDeviceNumber → serialNumber → manufacturer:product → antDeviceType → null
 * Keys are namespaced to prevent collisions between different identifier types.
 */
export function deviceKey(device: Device): string | null {
	if (device.antDeviceNumber != null) return `ant:${device.antDeviceNumber}`;
	if (device.serialNumber != null)    return `serial:${device.serialNumber}`;
	const m = device.manufacturer?.trim();
	const p = device.product?.trim();
	if (m || p) return `device:${m ?? ''}:${p ?? ''}`;
	if (device.antDeviceType != null)   return `type:${device.antDeviceType}`;
	return null;
}
