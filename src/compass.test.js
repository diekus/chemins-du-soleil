import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCompassHeading } from './compass.js';

test('C1 — getCompassHeading prefers webkitCompassHeading when present (iOS)', () => {
  const heading = getCompassHeading({ webkitCompassHeading: 123.4, absolute: false, alpha: 10 });
  assert.equal(heading, 123.4);
});

test('C2 — getCompassHeading inverts absolute alpha to compass convention', () => {
  // alpha=90 (counter-clockwise convention) → compass heading 270.
  const heading = getCompassHeading({ absolute: true, alpha: 90 });
  assert.equal(heading, 270);
});

test('C3 — getCompassHeading wraps the inverted value into 0-360', () => {
  const heading = getCompassHeading({ absolute: true, alpha: 0 });
  assert.equal(heading, 0);
});

test('C4 — getCompassHeading returns null for a non-absolute alpha (not north-referenced)', () => {
  const heading = getCompassHeading({ absolute: false, alpha: 45 });
  assert.equal(heading, null);
});

test('C5 — getCompassHeading returns null when alpha is missing entirely', () => {
  const heading = getCompassHeading({ absolute: true, alpha: null });
  assert.equal(heading, null);
});
