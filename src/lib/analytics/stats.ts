export function mean(values: (number | null)[]): number | null {
	const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
	if (nums.length === 0) return null;
	return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function stdDev(values: (number | null)[]): number | null {
	const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
	if (nums.length < 2) return null;
	const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
	const variance = nums.reduce((sum, v) => sum + (v - avg) ** 2, 0) / nums.length;
	return Math.sqrt(variance);
}
