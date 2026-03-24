import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Y_TOLERANCE,
  DEFAULT_DISTANCE,
  isHorizontal,
  isHorizontalSequenceFlow,
  computeGap,
  computeDelta,
  sortFlowsLeftToRight
} from '../client/bpmn-extension/util.mjs';


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('Y_TOLERANCE should be 1', () => {
    assert.equal(Y_TOLERANCE, 1);
  });

  it('DEFAULT_DISTANCE should be 50', () => {
    assert.equal(DEFAULT_DISTANCE, 50);
  });
});


// ---------------------------------------------------------------------------
// isHorizontal
// ---------------------------------------------------------------------------

describe('isHorizontal', () => {

  it('2 waypoints with same Y -> true', () => {
    assert.equal(isHorizontal([{ x: 0, y: 100 }, { x: 200, y: 100 }]), true);
  });

  it('2 waypoints with different Y -> false', () => {
    assert.equal(isHorizontal([{ x: 0, y: 100 }, { x: 200, y: 120 }]), false);
  });

  it('3 waypoints all same Y -> true', () => {
    assert.equal(
      isHorizontal([
        { x: 0, y: 50 },
        { x: 100, y: 50 },
        { x: 200, y: 50 }
      ]),
      true
    );
  });

  it('3 waypoints, one deviates -> false', () => {
    assert.equal(
      isHorizontal([
        { x: 0, y: 50 },
        { x: 100, y: 60 },
        { x: 200, y: 50 }
      ]),
      false
    );
  });

  it('within tolerance (0.5px difference) -> true', () => {
    assert.equal(
      isHorizontal([{ x: 0, y: 100 }, { x: 200, y: 100.5 }]),
      true
    );
  });

  it('exactly on tolerance boundary (1px) -> true', () => {
    assert.equal(
      isHorizontal([{ x: 0, y: 100 }, { x: 200, y: 101 }]),
      true
    );
  });

  it('just over tolerance (1.5px) -> false', () => {
    assert.equal(
      isHorizontal([{ x: 0, y: 100 }, { x: 200, y: 101.5 }]),
      false
    );
  });

  it('empty waypoints -> false', () => {
    assert.equal(isHorizontal([]), false);
  });

  it('null waypoints -> false', () => {
    assert.equal(isHorizontal(null), false);
  });

  it('undefined waypoints -> false', () => {
    assert.equal(isHorizontal(undefined), false);
  });

  it('only 1 waypoint -> false', () => {
    assert.equal(isHorizontal([{ x: 0, y: 100 }]), false);
  });
});


// ---------------------------------------------------------------------------
// isHorizontalSequenceFlow
// ---------------------------------------------------------------------------

describe('isHorizontalSequenceFlow', () => {

  it('SequenceFlow + horizontal -> true', () => {
    const element = {
      type: 'bpmn:SequenceFlow',
      waypoints: [{ x: 0, y: 100 }, { x: 200, y: 100 }]
    };
    assert.equal(isHorizontalSequenceFlow(element), true);
  });

  it('SequenceFlow + not horizontal -> false', () => {
    const element = {
      type: 'bpmn:SequenceFlow',
      waypoints: [{ x: 0, y: 100 }, { x: 200, y: 200 }]
    };
    assert.equal(isHorizontalSequenceFlow(element), false);
  });

  it('different type (bpmn:Task) -> false', () => {
    const element = {
      type: 'bpmn:Task',
      waypoints: [{ x: 0, y: 100 }, { x: 200, y: 100 }]
    };
    assert.equal(isHorizontalSequenceFlow(element), false);
  });

  it('null element -> false', () => {
    assert.equal(isHorizontalSequenceFlow(null), false);
  });

  it('undefined element -> false', () => {
    assert.equal(isHorizontalSequenceFlow(undefined), false);
  });
});


// ---------------------------------------------------------------------------
// computeGap
// ---------------------------------------------------------------------------

describe('computeGap', () => {

  it('normal gap: source x=100 w=100, target x=280 -> 80', () => {
    const source = { x: 100, width: 100 };
    const target = { x: 280 };
    assert.equal(computeGap(source, target), 80);
  });

  it('no gap: target directly adjacent -> 0', () => {
    const source = { x: 100, width: 100 };
    const target = { x: 200 };
    assert.equal(computeGap(source, target), 0);
  });

  it('negative gap: overlapping -> negative', () => {
    const source = { x: 100, width: 100 };
    const target = { x: 150 };
    assert.equal(computeGap(source, target), -50);
  });
});


// ---------------------------------------------------------------------------
// computeDelta
// ---------------------------------------------------------------------------

describe('computeDelta', () => {

  it('gap larger than target -> negative delta', () => {
    // gap=80, target=50 -> delta=-30
    assert.equal(computeDelta(80, 50), -30);
  });

  it('gap smaller than target -> positive delta', () => {
    // gap=30, target=50 -> delta=20
    assert.equal(computeDelta(30, 50), 20);
  });

  it('gap equals target -> 0', () => {
    assert.equal(computeDelta(50, 50), 0);
  });
});


// ---------------------------------------------------------------------------
// sortFlowsLeftToRight
// ---------------------------------------------------------------------------

describe('sortFlowsLeftToRight', () => {

  it('3 unsorted flows -> sorted by waypoints[0].x', () => {
    const flows = [
      { id: 'c', waypoints: [{ x: 300 }] },
      { id: 'a', waypoints: [{ x: 100 }] },
      { id: 'b', waypoints: [{ x: 200 }] }
    ];
    const sorted = sortFlowsLeftToRight(flows);
    assert.deepEqual(
      sorted.map(f => f.id),
      ['a', 'b', 'c']
    );
  });

  it('already sorted -> same order', () => {
    const flows = [
      { id: 'a', waypoints: [{ x: 10 }] },
      { id: 'b', waypoints: [{ x: 20 }] },
      { id: 'c', waypoints: [{ x: 30 }] }
    ];
    const sorted = sortFlowsLeftToRight(flows);
    assert.deepEqual(
      sorted.map(f => f.id),
      ['a', 'b', 'c']
    );
  });

  it('returns a new array (no mutation)', () => {
    const flows = [
      { id: 'b', waypoints: [{ x: 200 }] },
      { id: 'a', waypoints: [{ x: 100 }] }
    ];
    const sorted = sortFlowsLeftToRight(flows);
    assert.notStrictEqual(sorted, flows);
    // original should be unchanged
    assert.equal(flows[0].id, 'b');
    assert.equal(flows[1].id, 'a');
  });
});
