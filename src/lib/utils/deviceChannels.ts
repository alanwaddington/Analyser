import type { ChannelKey, CrossFileStream, Device } from '$lib/types';

/**
 * Derive a human-readable label for a device.
 * Priority: user-assigned label → manufacturer + product → "Device N"
 */
export function deriveDeviceLabel(device: Device): string {
	if (device.label?.trim()) return device.label;

	const parts = [device.manufacturer?.trim(), device.product?.trim()].filter(Boolean);
	if (parts.length > 0) return parts.join(' ');

	return `Device ${device.deviceIndex}`;
}

/**
 * Build the globally-unique key for a cross-file device stream.
 * Format: `${activityId}:${deviceIndex}`
 */
export function deviceKey(activityId: string, deviceIndex: number): string {
	return `${activityId}:${deviceIndex}`;
}

/**
 * Group cross-file device streams by the channels they contribute.
 * A stream appears once per channel it declares.
 */
export function groupStreamsByChannel(streams: CrossFileStream[]): Map<ChannelKey, CrossFileStream[]> {
	const map = new Map<ChannelKey, CrossFileStream[]>();
	for (const cfs of streams) {
		for (const ch of cfs.stream.channels) {
			const existing = map.get(ch);
			if (existing) {
				existing.push(cfs);
			} else {
				map.set(ch, [cfs]);
			}
		}
	}
	return map;
}

/**
 * Returns true when two or more cross-file streams contribute to the same channel —
 * i.e. there is something to compare.
 */
export function isComparableGroup(streams: CrossFileStream[]): boolean {
	return streams.length >= 2;
}

/**
 * Filter cross-file streams to only those that are active (key in activeIndices)
 * and contribute to the given channel.
 */
export function getActiveStreamsForChannel(
	streams: CrossFileStream[],
	channel: ChannelKey,
	activeIndices: Set<string>
): CrossFileStream[] {
	return streams.filter(
		s => activeIndices.has(s.key) && s.stream.channels.includes(channel)
	);
}
