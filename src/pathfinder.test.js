import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph } from './graph.js';
import { findRoutes } from './pathfinder.js';

// ── Fixture ───────────────────────────────────────────────────────────────────
//
//  start ──EasyLift(silver,lift)──► mid1 ──BlueRun(blue,slope)──► end
//  start ──HardSlope(black,slope)─► mid2 ──GreenFlat(green,slope)► end
//  island  (no connections — disconnected)
//
//  Route costs (silver=1, blue=2, black=4, green=1):
//    R1: start→mid1→end  = 1+2 = 3   (lower cost)
//    R2: start→mid2→end  = 4+1 = 5

const NET = {
  nodes: [
    {
      id: 'start', name: 'Start', country: 'FR', lift_type: 'gondola',
      connections: [
        { to: 'mid1', name: 'EasyLift',  type: 'lift',  difficulty: 'silver' },
        { to: 'mid2', name: 'HardSlope', type: 'slope', difficulty: 'black' },
      ],
    },
    {
      id: 'mid1', name: 'Mid1', country: 'FR', lift_type: 'chairlift',
      connections: [
        { to: 'end', name: 'BlueRun', type: 'slope', difficulty: 'blue' },
      ],
    },
    {
      id: 'mid2', name: 'Mid2', country: 'FR', lift_type: 'chairlift',
      connections: [
        { to: 'end', name: 'GreenFlat', type: 'slope', difficulty: 'green' },
      ],
    },
    { id: 'end',    name: 'End',    country: 'CH', lift_type: null, connections: [] },
    { id: 'island', name: 'Island', country: 'FR', lift_type: null, connections: [] },
  ],
};

const graph = loadGraph(NET);

// ── Tests ─────────────────────────────────────────────────────────────────────

test('P1 — findRoutes returns correct ordered steps for a known route', () => {
  const routes = findRoutes(graph, 'start', 'end', 'black');
  assert.ok(routes.length > 0, 'Expected at least one route');

  const best = routes[0];
  assert.deepEqual(best.path, ['start', 'mid1', 'end']);
  assert.equal(best.steps.length, 2);

  assert.deepEqual(best.steps[0], {
    from: 'start', to: 'mid1', name: 'EasyLift', type: 'lift', difficulty: 'silver',
  });
  assert.deepEqual(best.steps[1], {
    from: 'mid1', to: 'end', name: 'BlueRun', type: 'slope', difficulty: 'blue',
  });
});

test('P2 — findRoutes returns lowest-cost route first', () => {
  const routes = findRoutes(graph, 'start', 'end', 'black', 2);
  assert.equal(routes.length, 2);
  assert.equal(routes[0].cost, 3); // R1: silver(1) + blue(2)
  assert.equal(routes[1].cost, 5); // R2: black(4) + green(1)
  assert.ok(routes[0].cost <= routes[1].cost);
});

test('P3 — findRoutes respects difficulty filter: blue excludes black edges', () => {
  const routes = findRoutes(graph, 'start', 'end', 'blue');
  // HardSlope is black (weight 4 > maxWeight 2) → mid2 unreachable
  assert.equal(routes.length, 1);
  assert.deepEqual(routes[0].path, ['start', 'mid1', 'end']);
  assert.ok(
    routes[0].steps.every(s => s.difficulty !== 'black'),
    'No step should have difficulty black when maxDifficulty is blue',
  );
});

test('P4 — findRoutes returns empty array when no route exists', () => {
  const routes = findRoutes(graph, 'start', 'island', 'black');
  assert.deepEqual(routes, []);
});

test('P5 — findRoutes handles startId === endId', () => {
  const routes = findRoutes(graph, 'start', 'start', 'black');
  assert.equal(routes.length, 1);
  assert.deepEqual(routes[0], { path: ['start'], cost: 0, steps: [], preferenceScore: 0 });
});

test('P6 — findRoutes returns k distinct routes when k routes exist', () => {
  const routes = findRoutes(graph, 'start', 'end', 'black', 2);
  assert.equal(routes.length, 2);
  // Paths must be distinct
  assert.notDeepEqual(routes[0].path, routes[1].path);
});

test('P7 — findRoutes caps result at available routes, not k', () => {
  // Only 2 simple paths exist in NET; requesting 5 should return 2.
  const routes = findRoutes(graph, 'start', 'end', 'black', 5);
  assert.equal(routes.length, 2);
});
