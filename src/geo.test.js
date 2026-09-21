import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, nearestResort, projectOntoRoute } from './geo.js';

// A short straight "route" running due north for ~1km, split into two equal
// segments — easy to reason about progress fractions by hand.
const ROUTE = [
  { lat: 46.000, lon: 6.500 }, // start
  { lat: 46.0045, lon: 6.500 }, // midpoint (~0.5km north)
  { lat: 46.009, lon: 6.500 }, // end (~1km north)
];

test('G1 — haversineKm returns ~0 for identical points', () => {
  assert.ok(haversineKm(46, 6.5, 46, 6.5) < 1e-9);
});

test('G2 — nearestResort finds the closest of several candidates', () => {
  const resorts = [
    { name: 'Far',  lat: 47, lon: 8 },
    { name: 'Near', lat: 46.001, lon: 6.501 },
  ];
  const result = nearestResort(46, 6.5, resorts);
  assert.equal(result.resort.name, 'Near');
});

test('G3 — nearestResort returns null for an empty list', () => {
  assert.equal(nearestResort(46, 6.5, []), null);
});

test('P1 — projectOntoRoute returns null with fewer than 2 points', () => {
  assert.equal(projectOntoRoute(46, 6.5, [{ lat: 46, lon: 6.5 }]), null);
});

test('P2 — projectOntoRoute reports ~0 progress at the start', () => {
  const r = projectOntoRoute(46.000, 6.500, ROUTE);
  assert.ok(r.progress < 0.05);
  assert.ok(r.distanceKm < 0.01);
});

test('P3 — projectOntoRoute reports ~1 progress at the end', () => {
  const r = projectOntoRoute(46.009, 6.500, ROUTE);
  assert.ok(r.progress > 0.95);
});

test('P4 — projectOntoRoute reports ~0.5 progress at the midpoint', () => {
  const r = projectOntoRoute(46.0045, 6.500, ROUTE);
  assert.ok(Math.abs(r.progress - 0.5) < 0.05);
});

test('P5 — projectOntoRoute reports a large distanceKm when far off the route', () => {
  const r = projectOntoRoute(46.000, 6.700, ROUTE); // ~15km east of the route
  assert.ok(r.distanceKm > 10);
});

test('P6 — projectOntoRoute clamps off-the-end positions to the nearest segment', () => {
  const r = projectOntoRoute(46.020, 6.500, ROUTE); // north of the route's end
  assert.equal(r.segmentIndex, ROUTE.length - 2);
  assert.ok(r.progress >= 1);
});

test('P7 — projectOntoRoute snaps the returned lat/lon onto the route, not the raw device position', () => {
  // ~15km east of the route — the snapped point should land back on the
  // route's own longitude (6.5), not the device's actual longitude (6.7).
  const r = projectOntoRoute(46.002, 6.700, ROUTE);
  assert.ok(Math.abs(r.lon - 6.500) < 0.001);
  assert.ok(r.lat > 46.000 && r.lat < 46.009);
});

test('P8 — projectOntoRoute reports lat/lon matching the input when already on the route', () => {
  const r = projectOntoRoute(46.0045, 6.500, ROUTE);
  assert.ok(Math.abs(r.lat - 46.0045) < 0.0005);
  assert.ok(Math.abs(r.lon - 6.500) < 0.0005);
});
