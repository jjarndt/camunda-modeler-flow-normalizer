import {
  DEFAULT_DISTANCE,
  isHorizontalSequenceFlow,
  computeDelta,
  sortFlowsLeftToRight
} from './util.mjs';

const PROVIDER_PRIORITY = 900;

const NORMALIZE_ICON = '<div class="entry" style="display:flex;align-items:center;justify-content:center;">' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">' +
  '<path fill="#000" d="M21 6H3V4h18v2zm0 7H3v-2h18v2zm-9 7H3v-2h9v2z"/>' +
  '<path fill="#000" d="M16 17l4-4-4-4v3h-3v2h3v3z"/>' +
  '</svg></div>';

export default class FlowNormalizerProvider {

  constructor(modeling, elementRegistry, editorActions, contextPad, eventBus) {
    this._modeling = modeling;
    this._elementRegistry = elementRegistry;
    this._editorActions = editorActions;
    this._eventBus = eventBus;

    editorActions.register('normalizeHorizontalFlows', () => {
      this.normalizeAll();
    });

    contextPad.registerProvider(PROVIDER_PRIORITY, this);

    eventBus.on('flowNormalizer.normalize', (event) => {
      if (event.scope) {
        this.normalizeFromElement(event.scope, event.distance);
      } else {
        this.normalizeAll(event.distance);
      }
    });
  }

  getContextPadEntries(element) {
    if (!element?.outgoing) return {};

    const hasHorizontalFlows = element.outgoing.some(
      flow => isHorizontalSequenceFlow(flow)
    );

    if (!hasHorizontalFlows) return {};

    const eventBus = this._eventBus;

    return {
      'normalize-flows': {
        group: 'edit',
        html: NORMALIZE_ICON,
        title: 'Normalize horizontal flow distances',
        action: {
          click() {
            eventBus.fire('flowNormalizer.normalize', { scope: element });
          }
        }
      }
    };
  }

  normalizeAll(targetDistance = DEFAULT_DISTANCE) {
    const allElements = this._elementRegistry.getAll();
    const flows = allElements.filter(el => isHorizontalSequenceFlow(el));
    this._normalizeFlows(flows, targetDistance);
  }

  normalizeFromElement(element, targetDistance = DEFAULT_DISTANCE) {
    if (!element?.outgoing) return;

    const flows = element.outgoing.filter(flow => isHorizontalSequenceFlow(flow));
    this._normalizeFlows(flows, targetDistance);
  }

  _normalizeFlows(flows, targetDistance) {
    const eligible = flows.filter(flow => {
      if (!flow.source || !flow.target) return false;
      if (!flow.waypoints || flow.waypoints.length !== 2) return false;
      if (flow.target.type === 'bpmn:BoundaryEvent') return false;
      return true;
    });

    const sorted = sortFlowsLeftToRight(eligible);

    // Phase 1: Berechne alle Deltas vorher (bevor irgendwas verschoben wird)
    const moves = [];
    const cumulativeShift = new Map(); // elementId -> accumulated X shift

    for (const flow of sorted) {
      const source = flow.source;
      const target = flow.target;

      // Beruecksichtige bereits geplante Verschiebungen
      const sourceShift = cumulativeShift.get(source.id) || 0;
      const targetShift = cumulativeShift.get(target.id) || 0;

      const effectiveSourceRight = source.x + source.width + sourceShift;
      const effectiveTargetLeft = target.x + targetShift;
      const currentGap = effectiveTargetLeft - effectiveSourceRight;
      const delta = computeDelta(currentGap, targetDistance);

      if (Math.abs(delta) >= 1) {
        moves.push({ flow, target, delta });
        cumulativeShift.set(target.id, targetShift + delta);
      }
    }

    // Phase 2: Alle Moves ausfuehren
    let count = 0;
    for (const { target, delta } of moves) {
      this._modeling.moveElements([target], { x: delta, y: 0 });
      count++;
    }

    this._eventBus.fire('flowNormalizer.done', {
      count,
      distance: targetDistance
    });
  }
}

FlowNormalizerProvider.$inject = [
  'modeling',
  'elementRegistry',
  'editorActions',
  'contextPad',
  'eventBus'
];
