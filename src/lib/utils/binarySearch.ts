/**
 * Returns the index of the first element where key(element) >= target,
 * or arr.length if all elements are less than target.
 */
export function lowerBound<T>(arr: T[], key: (item: T) => number, target: number): number {
	let lo = 0;
	let hi = arr.length;

	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (key(arr[mid]) < target) lo = mid + 1;
		else hi = mid;
	}

	return lo;
}
