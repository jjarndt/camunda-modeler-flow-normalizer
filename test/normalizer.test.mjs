import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DISTANCE,
  isHorizontalSequenceFlow,
  computeGap,
  computeDelta,
  sortFlowsLeftToRight
} from '../client/bpmn-extension/util.mjs';


// ---------------------------------------------------------------------------
// Minimal normalizer logic extracted for testability.
//
// This mirrors the expected behaviour of the FlowNormalizerProvider:
//   1. Collect all horizontal SequenceFlows with exactly 2 waypoints.
//   2. Skip flows whose target is a BoundaryEvent.
//   3. Sort left-to-right.
//   4. For each flow compute gap & delta; skip if |delta| < 1.
//   5. Move elements downstream.
//   6. Fire "flowNormalizer.done" event.
// ---------------------------------------------------------------------------

function runNormalize({ allElements, modeling, eventBus, distance = DEFAULT_DISTANCE }) {

  const flows = allElements
    .filter(el => isHorizontalSequenceFlow(el))
    .filter(el => el.waypoints.length === 2)
    .filter(el => el.target?.type !== 'bpmn:BoundaryEvent');

  const sorted = sortFlowsLeftToRight(flows);

  let count = 0;

  for (const flow of sorted) {
    const gap = computeGap(flow.source, flow.target);
    const delta = computeDelta(gap, distance);

    if (Math.abs(delta) < 1) continue;

    modeling.moveElements([flow.target], { x: delta, y: 0 });
    count++;
  }

  eventBus.fire('flowNormalizer.done', { count, distance });
}


// ---------------------------------------------------------------------------
// Helpers to build mock elements
// ---------------------------------------------------------------------------

function makeShape(id, type, x, y, width = 100, height = 80) {
  return { id, type, x, y, width, height };
}

function makeFlow(id, source, target, waypoints) {
  return {
    id,
    type: 'bpmn:SequenceFlow',
    source,
    target,
    waypoints
  };
}

function horizontalWaypoints(source, target) {
  const y = source.y + source.height / 2;
  return [
    { x: source.x + source.width, y },
    { x: target.x, y }
  ];
}


// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FlowNormalizer integration', () => {

  let moves;
  let events;
  let mockModeling;
  let mockEventBus;

  beforeEach(() => {
    moves = [];
    events = [];
    mockModeling = {
      moveElements: (els, delta) => moves.push({ els, delta })
    };
    mockEventBus = {
      on: () => {},
      fire: (name, data) => events.push({ name, data })
    };
  });


  // -----------------------------------------------------------------------
  // Test 1
  // -----------------------------------------------------------------------

  it('single flow is normalised correctly', () => {
    const source = makeShape('A', 'bpmn:Task', 100, 100, 100, 80);
    const target = makeShape('B', 'bpmn:Task', 280, 100, 100, 80);
    const flow = makeFlow('f1', source, target, horizontalWaypoints(source, target));

    // gap = 280 - (100+100) = 80, delta = 50 - 80 = -30
    runNormalize({
      allElements: [source, target, flow],
      modeling: mockModeling,
      eventBus: mockEventBus
    });

    assert.equal(moves.length, 1);
    assert.deepEqual(moves[0].els, [target]);
    assert.deepEqual(moves[0].delta, { x: -30, y: 0 });
  });


  // -----------------------------------------------------------------------
  // Test 2
  // -----------------------------------------------------------------------

  it('multiple flows are processed left-to-right', () => {
    //  A --80px-- B --120px-- C
    const A = makeShape('A', 'bpmn:Task', 0, 100, 100, 80);
    const B = makeShape('B', 'bpmn:Task', 180, 100, 100, 80);
    const C = makeShape('C', 'bpmn:Task', 400, 100, 100, 80);

    const f1 = makeFlow('f1', A, B, horizontalWaypoints(A, B));
    const f2 = makeFlow('f2', B, C, horizontalWaypoints(B, C));

    runNormalize({
      allElements: [A, B, C, f1, f2],
      modeling: mockModeling,
      eventBus: mockEventBus
    });

    // f1: gap = 180 - 100 = 80, delta = 50 - 80 = -30
    // f2: gap = 400 - 280 = 120, delta = 50 - 120 = -70
    assert.equal(moves.length, 2);

    // first move is for f1 (leftmost)
    assert.deepEqual(moves[0].els, [B]);
    assert.deepEqual(moves[0].delta, { x: -30, y: 0 });

    // second move is for f2
    assert.deepEqual(moves[1].els, [C]);
    assert.deepEqual(moves[1].delta, { x: -70, y: 0 });
  });


  // -----------------------------------------------------------------------
  // Test 3
  // -----------------------------------------------------------------------

  it('non-horizontal flows are skipped', () => {
    const A = makeShape('A', 'bpmn:Task', 0, 100, 100, 80);
    const B = makeShape('B', 'bpmn:Task', 200, 100, 100, 80);
    const C = makeShape('C', 'bpmn:Task', 200, 300, 100, 80);

    const horizontal = makeFlow('fH', A, B, horizontalWaypoints(A, B));
    const vertical = makeFlow('fV', A, C, [
      { x: 100, y: 140 },
      { x: 200, y: 340 }
    ]);

    runNormalize({
      allElements: [A, B, C, horizontal, vertical],
      modeling: mockModeling,
      eventBus: mockEventBus
    });

    // Only the horizontal flow should trigger a move
    assert.equal(moves.length, 1);
    assert.deepEqual(moves[0].els, [B]);
  });


  // -----------------------------------------------------------------------
  // Test 4
  // -----------------------------------------------------------------------

  it('BoundaryEvent target is skipped', () => {
    const A = makeShape('A', 'bpmn:Task', 0, 100, 100, 80);
    const boundary = makeShape('BE', 'bpmn:BoundaryEvent', 200, 100, 36, 36);

    const flow = makeFlow('fBE', A, boundary, horizontalWaypoints(A, boundary));

    runNormalize({
      allElements: [A, boundary, flow],
      modeling: mockModeling,
      eventBus: mockEventBus
    });

    assert.equal(moves.length, 0);
  });


  // -----------------------------------------------------------------------
  // Test 5
  // -----------------------------------------------------------------------

  it('flow with 3+ waypoints (bend) is skipped', () => {
    const A = makeShape('A', 'bpmn:Task', 0, 100, 100, 80);
    const B = makeShape('B', 'bpmn:Task', 300, 100, 100, 80);

    const y = 140;
    const flow = makeFlow('fBend', A, B, [
      { x: 100, y },
      { x: 200, y },   // bend point
      { x: 300, y }
    ]);

    runNormalize({
      allElements: [A, B, flow],
      modeling: mockModeling,
      eventBus: mockEventBus
    });

    assert.equal(moves.length, 0);
  });


  // -----------------------------------------------------------------------
  // Test 6
  // -----------------------------------------------------------------------

  it('delta < 1 is skipped (already at target distance)', () => {
    const A = makeShape('A', 'bpmn:Task', 0, 100, 100, 80);
    // gap = 150 - 100 = 50 -> delta = 50 - 50 = 0
    const B = makeShape('B', 'bpmn:Task', 150, 100, 100, 80);

    const flow = makeFlow('fOK', A, B, horizontalWaypoints(A, B));

    runNormalize({
      allElements: [A, B, flow],
      modeling: mockModeling,
      eventBus: mockEventBus
    });

    assert.equal(moves.length, 0);
  });


  // -----------------------------------------------------------------------
  // Test 7
  // -----------------------------------------------------------------------

  it('flowNormalizer.done event is fired with count and distance', () => {
    const A = makeShape('A', 'bpmn:Task', 0, 100, 100, 80);
    const B = makeShape('B', 'bpmn:Task', 200, 100, 100, 80);
    const flow = makeFlow('f1', A, B, horizontalWaypoints(A, B));

    runNormalize({
      allElements: [A, B, flow],
      modeling: mockModeling,
      eventBus: mockEventBus
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'flowNormalizer.done');
    assert.equal(events[0].data.count, 1);
    assert.equal(events[0].data.distance, DEFAULT_DISTANCE);
  });

  it('flowNormalizer.done reports count=0 when nothing was moved', () => {
    const A = makeShape('A', 'bpmn:Task', 0, 100, 100, 80);
    const B = makeShape('B', 'bpmn:Task', 150, 100, 100, 80);
    const flow = makeFlow('fOK', A, B, horizontalWaypoints(A, B));

    runNormalize({
      allElements: [A, B, flow],
      modeling: mockModeling,
      eventBus: mockEventBus
    });

    assert.equal(events.length, 1);
    assert.equal(events[0].data.count, 0);
  });
});
