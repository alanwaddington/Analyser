export interface ChannelSummary {
	avg: number;
	max: number;
	min: number;
}

export function summarise(values: (number | null)[]): ChannelSummary | null {
	const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
	if (nums.length === 0) return null;
	return {
		avg: nums.reduce((a, b) => a + b, 0) / nums.length,
		max: Math.max(...nums),
		min: Math.min(...nums)
	};
}
