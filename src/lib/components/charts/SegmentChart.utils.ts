import type { Activity } from '$lib/types';
import { timeAtDistance } from '$lib/compare/delta';

export interface SegmentSeriesInput {
	activity: Activity;
	colourIndex: number;
}

export interface Segment {
	label: string;
	startDist: number;
	endDist: number;
}

export function segmentTime(activity: Activity, segment: Segment): number {
	if (activity.records.length === 0) return 0;
	const startTime = timeAtDistance(activity, segment.startDist);
	const endTime = timeAtDistance(activity, segment.endDist);
	if (startTime == null || endTime == null) return 0;
	const lastDist = activity.records[activity.records.length - 1].distance;
	if (segment.endDist > lastDist) return 0;
	return endTime - startTime;
}

export function computeSegmentDeltas(
	reference: Activity,
	candidate: Activity,
	segments: Segment[],
): { label: string; delta: number }[] {
	return segments.map(seg => ({
		label: seg.label,
		delta: segmentTime(reference, seg) - segmentTime(candidate, seg),
	}));
}
