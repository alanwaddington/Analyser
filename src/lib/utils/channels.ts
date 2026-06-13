import type { Activity, ChannelKey } from '$lib/types';
import { ALL_RECORD_CHANNELS as ALL_CHANNELS } from '$lib/fit/parser';

export function deriveAvailableChannels(activities: Activity[]): ChannelKey[] {
	const union = new Set<ChannelKey>();
	for (const a of activities) {
		for (const ch of a.availableChannels) union.add(ch);
	}
	return ALL_CHANNELS.filter(ch => union.has(ch));
}
