import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGraph } from './graph.js';
import { buildMeetUrl, parseMeetParams, findMeetupRoutes } from './meetup.js';
import { isInPortesDuSoleil, nodesByDistance } from './geo.js';

// A tiny line network running due north: lift A→B, then a blue piste B→C.
const NETWORK = {
  nodes: [
    { id: 'a', station_type: 'lift-base', lat: 46.000, lon: 6.500, connections: [{ to: 'b', name: 'Lift', type: 'lift', difficulty: 'silver' }] },
    { id: 'b', station_type: 'lift-top',  lat: 46.010, lon: 6.500, connections: [{ to: 'c', name: 'Piste', type: 'slope', difficulty: 'blue' }] },
    { id: 'c', station_type: 'junction',  lat: 46.005, lon: 6.505, connections: [] },
  ],
};
const graph = loadGraph(NETWORK);

test('M1 — buildMeetUrl/parseMeetParams round-trip a position', () => {
  const url = new URL(buildMeetUrl('https://example.test/', 46.123456789, 6.7, 1700000000000));
  assert.ok(url.hash.startsWith('#meet?'));
  const parsed = parseMeetParams(new URLSearchParams(url.hash.slice('#meet?'.length)));
  assert.equal(parsed.lat, 46.12346);
  assert.equal(parsed.lon, 6.7);
  assert.equal(parsed.time, 1700000000000);
});

test('M2 — parseMeetParams rejects missing or non-numeric coordinates', () => {
  assert.equal(parseMeetParams(new URLSearchParams('lat=46')), null);
  assert.equal(parseMeetParams(new URLSearchParams('lat=abc&lon=6')), null);
  assert.equal(parseMeetParams(new URLSearchParams('lat=95&lon=6')), null);
});

test('M3 — findMeetupRoutes routes from the nearest lift base to the node nearest the shared spot', () => {
  const r = findMeetupRoutes(graph, NETWORK.nodes, { lat: 45.999, lon: 6.500 }, { lat: 46.0051, lon: 6.5051 }, 'black');
  assert.equal(r.status, 'ok');
  assert.equal(r.startId, 'a');
  assert.equal(r.endId, 'c');
  assert.deepEqual(r.routes[0].path, ['a', 'b', 'c']);
});

test('M4 — findMeetupRoutes reports already-there when both positions are close', () => {
  const r = findMeetupRoutes(graph, NETWORK.nodes, { lat: 46.005, lon: 6.505 }, { lat: 46.0051, lon: 6.5051 }, 'black');
  assert.equal(r.status, 'already-there');
});

test('M5 — findMeetupRoutes reports at-start when the shared spot is the receiver\'s nearest lift', () => {
  const r = findMeetupRoutes(graph, NETWORK.nodes, { lat: 45.995, lon: 6.500 }, { lat: 46.0001, lon: 6.500 }, 'black');
  assert.equal(r.status, 'at-start');
  assert.equal(r.startId, 'a');
});

test('M6 — findMeetupRoutes returns no routes when the difficulty ceiling blocks every path', () => {
  const r = findMeetupRoutes(graph, NETWORK.nodes, { lat: 45.999, lon: 6.500 }, { lat: 46.0051, lon: 6.5051 }, 'green');
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.routes, []);
});

test('M7 — isInPortesDuSoleil accepts on-network positions and rejects distant ones', () => {
  assert.equal(isInPortesDuSoleil(46.0051, 6.5051, NETWORK.nodes), true);
  assert.equal(isInPortesDuSoleil(46.2, 6.5, NETWORK.nodes), false); // ~20km north
});

test('M8 — nodesByDistance sorts nearest-first and applies the filter', () => {
  const r = nodesByDistance(46.009, 6.500, NETWORK.nodes, n => n.station_type !== 'junction');
  assert.deepEqual(r.map(c => c.node.id), ['b', 'a']);
});

test('M9 — real network: Morzine-area receiver gets a route to an Avoriaz-area shared spot', () => {
  const network = JSON.parse(readFileSync(new URL('../data/network.json', import.meta.url)));
  const realGraph = loadGraph(network);
  const resorts = JSON.parse(readFileSync(new URL('../data/resorts.json', import.meta.url))).resorts;
  const morzine = resorts.find(r => r.slug === 'morzine');
  const avoriaz = resorts.find(r => r.slug === 'avoriaz');
  assert.ok(morzine && avoriaz, 'expected morzine and avoriaz in resorts.json');
  assert.ok(isInPortesDuSoleil(morzine.lat, morzine.lon, network.nodes));
  const r = findMeetupRoutes(realGraph, network.nodes, morzine, avoriaz, 'black');
  assert.equal(r.status, 'ok');
  assert.ok(r.routes.length > 0);
  assert.equal(network.nodes.find(n => n.id === r.startId).station_type, 'lift-base');
});
