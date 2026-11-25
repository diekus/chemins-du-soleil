import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dedupeSteps, verticalChange } from './steps.js';

const nodes = new Map([
  ['top', { id: 'top', country: 'FR', elevation: 2000 }],
  ['mid', { id: 'mid', country: 'FR', elevation: 1700 }],
  ['bot', { id: 'bot', country: 'FR', elevation: 1404 }],
  ['flat', { id: 'flat', country: 'FR', elevation: 1406 }],
  ['none', { id: 'none', country: 'FR', elevation: null }],
]);

test('VD1 — a descent is negative, a climb positive, rounded to 10 m', () => {
  assert.equal(verticalChange({ from: 'top', to: 'bot' }, nodes), -600);
  assert.equal(verticalChange({ from: 'bot', to: 'mid' }, nodes), 300);
});

test('VD2 — changes within DEM noise (< 10 m) are not shown', () => {
  assert.equal(verticalChange({ from: 'bot', to: 'flat' }, nodes), null);
});

test('VD3 — a missing elevation yields null, never a guess', () => {
  assert.equal(verticalChange({ from: 'top', to: 'none' }, nodes), null);
  assert.equal(verticalChange({ from: 'top', to: 'nowhere' }, nodes), null);
});

test('VD4 — a piste split by a junction merges into one step spanning both pieces', () => {
  const steps = [
    { from: 'top', to: 'mid', name: 'Lac', type: 'slope', difficulty: 'blue' },
    { from: 'mid', to: 'bot', name: 'Lac', type: 'slope', difficulty: 'blue' },
  ];
  const out = dedupeSteps(steps, nodes);
  assert.equal(out.length, 1);
  assert.equal(out[0].from, 'top');
  assert.equal(out[0].to, 'bot');
  assert.equal(verticalChange(out[0], nodes), -600);
  assert.equal(steps[0].to, 'mid', 'input steps are not mutated');
});

test('VD5 — every network node has an elevation, so every step can show one', () => {
  const network = JSON.parse(readFileSync(new URL('../data/network.json', import.meta.url), 'utf8'));
  const missing = network.nodes.filter(n => typeof n.elevation !== 'number').map(n => n.id);
  assert.deepEqual(missing, []);
});
