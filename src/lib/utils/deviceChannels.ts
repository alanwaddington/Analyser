import type { Activity, ChannelKey, CrossFileStream, Device, DeviceStream } from '$lib/types';

/** Map known manufacturer names (from fit-file-parser, which emits lowercase strings) to display names. */
const MANUFACTURER_NAMES: Record<string, string> = {
	garmin: 'Garmin',
	suunto: 'Suunto',
	coros: 'COROS',
	polar: 'Polar',
	wahoo: 'Wahoo',
};

/**
 * Derive a human-readable label for a device.
 *
 * For power-contributing devices in running activities, the label reflects
 * the power source: "Stryd", "[Manufacturer] Running Power", or "Watch Running Power".
 *
 * Priority: user-assigned label → power source label (when applicable) → manufacturer + product → "Device N"
 */
export function deriveDeviceLabel(device: Device, stream?: Pick<DeviceStream, 'channels'>, activity?: Activity): string {
	if (device.label?.trim()) return device.label;

	// Source-aware power labelling: only applies when the stream contributes 'power'
	// and the activity has a known powerSource.
	if (stream?.channels.includes('power') && activity?.powerSource) {
		if (activity.powerSource === 'stryd') return 'Stryd';
		if (activity.powerSource === 'native') {
			const mfr = typeof device.manufacturer === 'string'
				? MANUFACTURER_NAMES[device.manufacturer.toLowerCase()]
				: undefined;
			return `${mfr ?? 'Watch'} Running Power`;
		}
		// 'cycling' — fall through to standard label (e.g. "favero Assioma DUO")
	}

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
