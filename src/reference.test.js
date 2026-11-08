import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { buildReference, SLOPE_DIFFICULTIES } from './reference.js';

// Run against the real data, so a regenerated network.json that the
// reference page would misrepresent fails here.
const network = JSON.parse(readFileSync(new URL('../data/network.json', import.meta.url)));
const { resorts } = JSON.parse(readFileSync(new URL('../data/resorts.json', import.meta.url)));
const reference = buildReference(network, resorts);
const bySlug = Object.fromEntries(reference.map(e => [e.resort.slug, e]));

test('RF1 — one entry per resort, in resorts.json order', () => {
  assert.deepEqual(reference.map(e => e.resort.slug), resorts.map(r => r.slug));
});

test('RF2 — every lift in network.json is listed under some resort', () => {
  const listed = new Set(reference.flatMap(e => e.lifts.map(l => l.name)));
  for (const n of network.nodes) {
    for (const c of n.connections) {
      if (c.type === 'lift') assert.ok(listed.has(c.name), `lift "${c.name}" missing`);
    }
  }
});

test('RF3 — every named slope in network.json is listed under some resort', () => {
  const listed = new Set(reference.flatMap(e => SLOPE_DIFFICULTIES.flatMap(d => e.slopes[d].map(s => `${s}|${d}`))));
  for (const n of network.nodes) {
    for (const c of n.connections) {
      if (c.type !== 'slope' || c.name.startsWith('Slope (')) continue;
      assert.ok(listed.has(`${c.name}|${c.difficulty}`), `slope "${c.name}" (${c.difficulty}) missing`);
    }
  }
});

test('RF4 — self-contained sectors stay with their own resort', () => {
  const lifts = slug => bySlug[slug].lifts.map(l => l.name);
  assert.ok(lifts('chapelle-abondance').includes('Crêt Béni'));
  assert.ok(lifts('st-jean-aulps').includes('Bray'));
  // Near La Chapelle, but on the main network: must not be pulled into its sector.
  assert.ok(lifts('chatel').includes('Panthiaz'));
  assert.ok(!lifts('chapelle-abondance').includes('Panthiaz'));
});

test('RF5 — a piste split into several edges is listed once', () => {
  for (const e of reference) {
    for (const d of SLOPE_DIFFICULTIES) {
      assert.equal(new Set(e.slopes[d]).size, e.slopes[d].length, `${e.resort.slug} ${d} has duplicates`);
    }
  }
});
