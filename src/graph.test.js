import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGraph, DIFFICULTY_WEIGHT } from './graph.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SIMPLE = {
  nodes: [
    {
      id: 'a', name: 'A', country: 'FR', lift_type: 'gondola',
      connections: [
        { to: 'b', name: 'AB', type: 'lift',  difficulty: 'silver' },
        { to: 'c', name: 'AC', type: 'slope', difficulty: 'blue'  },
      ],
    },
    {
      id: 'b', name: 'B', country: 'FR', lift_type: 'chairlift',
      connections: [
        { to: 'c', name: 'BC', type: 'slope', difficulty: 'red' },
      ],
    },
    { id: 'c', name: 'C', country: 'FR', lift_type: null, connections: [] },
  ],
};

// Node 'b' intentionally missing the explicit reverse to 'a'.
const BIDI_MISSING_REVERSE = {
  nodes: [
    {
      id: 'a', name: 'A', country: 'FR', lift_type: 'gondola',
      connections: [
        { to: 'b', name: 'CableCar', type: 'lift', difficulty: 'silver', bidirectional: true },
      ],
    },
    { id: 'b', name: 'B', country: 'CH', lift_type: 'telecabin', connections: [] },
  ],
};

// Both directions declared explicitly.
const BIDI_WITH_REVERSE = {
  nodes: [
    {
      id: 'a', name: 'A', country: 'FR', lift_type: 'gondola',
      connections: [
        { to: 'b', name: 'CableCar', type: 'lift', difficulty: 'silver', bidirectional: true },
      ],
    },
    {
      id: 'b', name: 'B', country: 'CH', lift_type: 'telecabin',
      connections: [
        { to: 'a', name: 'CableCar', type: 'lift', difficulty: 'green', bidirectional: true },
      ],
    },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

test('DIFFICULTY_WEIGHT has correct values', () => {
  assert.equal(DIFFICULTY_WEIGHT.silver, 1);
  assert.equal(DIFFICULTY_WEIGHT.green,  1);
  assert.equal(DIFFICULTY_WEIGHT.blue,   2);
  assert.equal(DIFFICULTY_WEIGHT.red,    3);
  assert.equal(DIFFICULTY_WEIGHT.black,  4);
});

test('G1 — loadGraph builds correct edge count', () => {
  const graph = loadGraph(SIMPLE);
  const total = [...graph.values()].reduce((n, edges) => n + edges.length, 0);
  assert.equal(total, 3); // AB, AC, BC
});

test('G1 — edge weights match difficulty', () => {
  const graph = loadGraph(SIMPLE);
  const ab = graph.get('a').find(e => e.name === 'AB');
  const ac = graph.get('a').find(e => e.name === 'AC');
  const bc = graph.get('b').find(e => e.name === 'BC');
  assert.equal(ab.weight, 1); // silver
  assert.equal(ac.weight, 2); // blue
  assert.equal(bc.weight, 3); // red
});

test('G2 — loadGraph safety net inserts missing reverse edge', () => {
  const graph = loadGraph(BIDI_MISSING_REVERSE);
  const bEdges = graph.get('b');
  assert.ok(
    bEdges.some(e => e.to === 'a' && e.name === 'CableCar'),
    'Expected reverse edge b→a to be inserted by safety net',
  );
});

test('G2 — safety net reverse edge has correct weight', () => {
  const graph = loadGraph(BIDI_MISSING_REVERSE);
  const reverse = graph.get('b').find(e => e.to === 'a' && e.name === 'CableCar');
  assert.equal(reverse.weight, 1); // silver
});

test('G3 — loadGraph deduplicates when reverse already exists', () => {
  const graph = loadGraph(BIDI_WITH_REVERSE);
  const reversals = graph.get('b').filter(e => e.to === 'a' && e.name === 'CableCar');
  assert.equal(reversals.length, 1, 'Safety net must not add a second copy of an existing reverse edge');
});
