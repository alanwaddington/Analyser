import type { ActivityRecord, ChannelKey } from '$lib/types';
import { CHANNEL_META } from '$lib/types';
import { formatPace } from '$lib/utils/formatting';

export type ExportFormat = 'csv' | 'xlsx';

export const CHANNEL_KEYS: ChannelKey[] = [
	'heartRate',
	'power',
	'powerLeft',
	'powerRight',
	'cadence',
	'speed',
	'pace',
	'altitude',
	'temperature',
	'coreTemperature',
	'skinTemperature',
	'verticalOscillation',
	'groundContactTime',
	'strideLength',
];

export function presentChannels(records: ActivityRecord[]): ChannelKey[] {
	return CHANNEL_KEYS.filter(key =>
		records.some(r => r[key] != null),
	);
}

export function buildHeaderLabel(key: ChannelKey): string {
	return `${CHANNEL_META[key].label} (${CHANNEL_META[key].unit})`;
}

export function formatCellValue(
	key: ChannelKey,
	value: unknown,
): string | number | Date | null {
	if (value == null) return null;
	if (key === 'pace') return formatPace(value as number);
	return value as string | number | Date;
}

/** RFC 4180: wrap in double-quotes if the value contains comma, quote, or newline; double any internal quotes. */
export function escapeCsvField(value: string): string {
	if (!value.includes(',') && !value.includes('"') && !value.includes('\n') && !value.includes('\r')) {
		return value;
	}
	return `"${value.replace(/"/g, '""')}"`;
}
