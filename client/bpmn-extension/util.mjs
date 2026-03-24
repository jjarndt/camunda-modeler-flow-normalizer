export const Y_TOLERANCE = 1;
export const DEFAULT_DISTANCE = 50;

/**
 * Returns true if all waypoints share the same Y coordinate (within tolerance).
 */
export function isHorizontal(waypoints) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return false;

  const refY = waypoints[0].y;
  return waypoints.every(wp => Math.abs(wp.y - refY) <= Y_TOLERANCE);
}

/**
 * Returns true if the element is a horizontal SequenceFlow.
 */
export function isHorizontalSequenceFlow(element) {
  return element?.type === 'bpmn:SequenceFlow' && isHorizontal(element.waypoints);
}

/**
 * Computes the horizontal gap between source and target elements.
 * Gap = target.x - (source.x + source.width)
 */
export function computeGap(source, target) {
  return target.x - (source.x + source.width);
}

/**
 * Computes the delta needed to reach the target distance.
 * A positive delta means the target must move right, negative means left.
 */
export function computeDelta(currentGap, targetDistance) {
  return targetDistance - currentGap;
}

/**
 * Returns a new array of flows sorted by the X coordinate of their first waypoint (left to right).
 */
export function sortFlowsLeftToRight(flows) {
  return [...flows].sort((a, b) => {
    const ax = a.waypoints?.[0]?.x ?? 0;
    const bx = b.waypoints?.[0]?.x ?? 0;
    return ax - bx;
  });
}
