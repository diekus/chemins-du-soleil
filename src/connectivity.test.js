import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { loadGraph } from './graph.js';
import { findRoutes } from './pathfinder.js';

// Exhaustive route checks against the real data/network.json. In a linked ski
// domain you can get from any lift to any other and back, so within each
// self-contained part of the network (the main Portes du Soleil domain, and
// the shuttle-only sectors: Roc d'Enfer, La Chapelle-d'Abondance, Abondance)
// every lift must be mutually reachable. A lift that isn't is a missing
// connection — the regression this guards against is a regenerated network
// that is quietly one-way (you can ski into a sector but never back out).

const network = JSON.parse(readFileSync(new URL('../data/network.json', import.meta.url)));
const graph = loadGraph(network);
const nodes = new Map(network.nodes.map(n => [n.id, n]));
const liftName = id => nodes.get(id).connections.find(c => c.type === 'lift')?.name ?? id;
const bases = network.nodes.filter(n => n.station_type === 'lift-base');

function reach(start, adjacency) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    for (const next of adjacency(queue.pop())) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}
const forward = id => (graph.get(id) ?? []).map(e => e.to);
const reverseAdj = new Map(network.nodes.map(n => [n.id, []]));
for (const [from, edges] of graph) for (const e of edges) reverseAdj.get(e.to)?.push(from);
const backward = id => reverseAdj.get(id) ?? [];
const undirected = id => [...forward(id), ...backward(id)];

// Self-contained parts of the network (ignoring direction), largest first.
const parts = [];
{
  const assigned = new Set();
  for (const b of bases) {
    if (assigned.has(b.id)) continue;
    const part = reach(b.id, undirected);
    for (const id of part) assigned.add(id);
    parts.push(bases.filter(x => part.has(x.id)).map(x => x.id));
  }
  parts.sort((a, b) => b.length - a.length);
}

test('C1 — every lift can reach, and be reached from, every other lift in its part of the network', () => {
  const problems = [];
  for (const part of parts) {
    if (part.length < 2) continue;
    // Strong connectivity of a set == one member reaches all and is reached by all.
    const hub = part[0];
    const out = reach(hub, forward), back = reach(hub, backward);
    for (const id of part) {
      if (!out.has(id)) problems.push(`can't reach ${liftName(id)} from ${liftName(hub)}`);
      if (!back.has(id)) problems.push(`can't get back to ${liftName(hub)} from ${liftName(id)}`);
    }
  }
  assert.deepEqual(problems, []);
});

// Loy is Châtel's Club Piou Piou ski-school nursery (a drag lift and a 40 m
// conveyor), reached only by shuttle bus line 2 — "Loy" stop (chatel.com,
// Club Piou Piou – Village des Marmottons) — not by any lift or piste.
test('C2 — only the known shuttle-only sectors are separate from the main domain', () => {
  const separate = parts.slice(1).filter(p => p.length >= 2).map(p => p.map(liftName));
  const sectors = separate.map(names =>
    ['Grande Terche', 'Crêt Béni', 'Essert', 'Loy'].find(anchor => names.includes(anchor)) ?? names.join(', '));
  assert.deepEqual(sectors.sort(), ['Crêt Béni', 'Essert', 'Grande Terche', 'Loy']);
});

// Cross-domain itineraries read off the official Portes du Soleil piste maps
// (2026-27 Les Gets–Morzine, 2025-26 Avoriaz / Châtel / Champéry–Les
// Crosets–Champoussin–Morgins sector maps). Each must return at least one route.
const ITINERARIES = [
  ['morzine-village', 'chatel-village'],
  ['chatel-village', 'morzine-village'],
  ['les-gets-village', 'champery'],
  ['champery', 'les-gets-village'],
  ['morgins-village', 'morzine-village'],
  ['morzine-village', 'morgins-village'],
];
for (const [from, to] of ITINERARIES) {
  test(`C3 — ${nodes.get(from).name} → ${nodes.get(to).name} has a route`, () => {
    assert.ok(findRoutes(graph, from, to, 'black', 1).length > 0);
  });
}
