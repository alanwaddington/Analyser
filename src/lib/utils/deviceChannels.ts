import type { ChannelKey, Device, DeviceStream } from '$lib/types';

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
 * Group device streams by the channels they contribute.
 * A stream appears once per channel it declares.
 */
export function groupStreamsByChannel(streams: DeviceStream[]): Map<ChannelKey, DeviceStream[]> {
	const map = new Map<ChannelKey, DeviceStream[]>();
	for (const stream of streams) {
		for (const ch of stream.channels) {
			const existing = map.get(ch);
			if (existing) {
				existing.push(stream);
			} else {
				map.set(ch, [stream]);
			}
		}
	}
	return map;
}

/**
 * Returns true when two or more devices contribute to the same channel —
 * i.e. there is something to compare.
 */
export function isComparableGroup(streams: DeviceStream[]): boolean {
	return streams.length >= 2;
}

/**
 * Filter streams to only those that are active (device index in activeIndices)
 * and contribute to the given channel.
 */
export function getActiveStreamsForChannel(
	streams: DeviceStream[],
	channel: ChannelKey,
	activeIndices: Set<number>
): DeviceStream[] {
	return streams.filter(
		s => activeIndices.has(s.device.deviceIndex) && s.channels.includes(channel)
	);
}
