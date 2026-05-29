// Activity alignment: interpolate record streams to a shared distance axis
export { interpolateToDistanceAxis } from './distance';
// Timestamp alignment: compute per-file time offsets for cross-file device comparison
export { computeTimeOffsets, computeAnchoredOffsets, activitiesOverlap } from './timestamp';
// Anchor selection: find the best alignment anchor for each activity
export { findAnchor, haversineDistance, GPS_PROXIMITY_THRESHOLD_M } from './anchor';
