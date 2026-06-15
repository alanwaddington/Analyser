import type { GpsPointWithDistance } from '$lib/types';

export const GPS_MAX_POINTS = 500;

/**
 * Perpendicular distance from point P to the line segment defined by A and B,
 * operating in raw lat/lon degree space. Sufficient for visual simplification
 * within a local geographic area (< a few hundred km).
 */
function perpDist(
	ALat: number, ALon: number,
	BLat: number, BLon: number,
	PLat: number, PLon: number,
): number {
	const dLat = BLat - ALat;
	const dLon = BLon - ALon;
	const lenSq = dLat * dLat + dLon * dLon;
	if (lenSq === 0) {
		// A and B are the same point
		const eLat = PLat - ALat;
		const eLon = PLon - ALon;
		return Math.sqrt(eLat * eLat + eLon * eLon);
	}
	// Signed area of triangle ABP x 2 / |AB|
	const cross = Math.abs(dLat * (ALon - PLon) - (ALat - PLat) * dLon);
	return cross / Math.sqrt(lenSq);
}

/**
 * Ramer-Douglas-Peucker simplification, iterative (stack-based) to avoid
 * stack overflow on large or degenerate GPS traces.
 */
function rdp(points: GpsPointWithDistance[], epsilon: number): GpsPointWithDistance[] {
	if (points.length <= 2) return points;

	const keep = new Array<boolean>(points.length).fill(false);
	keep[0] = true;
	keep[points.length - 1] = true;

	// Stack holds [start, end] index pairs to process
	const stack: [number, number][] = [[0, points.length - 1]];

	while (stack.length > 0) {
		const [start, end] = stack.pop()!;
		if (end - start < 2) continue;

		const A = points[start];
		const B = points[end];
		let maxDist = 0;
		let maxIdx = start;

		for (let i = start + 1; i < end; i++) {
			const d = perpDist(A.lat, A.lon, B.lat, B.lon, points[i].lat, points[i].lon);
			if (d > maxDist) {
				maxDist = d;
				maxIdx = i;
			}
		}

		if (maxDist > epsilon) {
			keep[maxIdx] = true;
			stack.push([start, maxIdx]);
			stack.push([maxIdx, end]);
		}
	}

	return points.filter((_, i) => keep[i]);
}

function uniformDecimate(points: GpsPointWithDistance[], maxPoints: number): GpsPointWithDistance[] {
	if (points.length <= maxPoints) return points;
	const result: GpsPointWithDistance[] = [];
	const step = (points.length - 1) / (maxPoints - 1);
	for (let i = 0; i < maxPoints - 1; i++) {
		result.push(points[Math.round(i * step)]);
	}
	result.push(points[points.length - 1]);
	return result;
}

/**
 * Downsample GPS points using Ramer-Douglas-Peucker to at most maxPoints.
 * If RDP alone leaves more than maxPoints, uniform decimation is applied as
 * a fallback to guarantee the upper bound.
 *
 * Each output point retains its original recordIndex from the input, so
 * metric values can be looked up from activity.records[] at O(1) cost.
 *
 * Returns the input array unchanged (same reference) when no reduction is needed.
 */
export function downsampleGps(
	points: GpsPointWithDistance[],
	maxPoints: number,
	epsilon = 0.00005, // approx 5 m at equator in degree units
): GpsPointWithDistance[] {
	if (points.length <= maxPoints) return points;

	const simplified = rdp(points, epsilon);
	if (simplified.length <= maxPoints) return simplified;

	return uniformDecimate(simplified, maxPoints);
}
