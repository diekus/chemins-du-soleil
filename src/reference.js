import { nearestResort } from './geo.js';

/**
 * Builds the per-resort lift & slope reference (reference.html) straight from
 * data/network.json, so it can never drift from the routing network.
 *
 * network.json has no resort field, so each lift/slope is placed in the
 * resort whose centroid (data/resorts.json) is nearest — restricted to the
 * same country, and respecting the network's own topology: a self-contained
 * sub-graph with its own lifts (Roc d'Enfer, La Chapelle-d'Abondance — see
 * CLAUDE.md) belongs wholesale to the resort nearest its centre, and nothing
 * outside it is ever placed there. Without that, lifts near the edge of such
 * a sector (e.g. Châtel's Panthiaz) would be pulled into it.
 */

export const SLOPE_DIFFICULTIES = ['green', 'blue', 'red', 'black'];

// A disconnected component needs this many lifts to count as its own sector,
// rather than a stray fragment of OSM tracing.
const MIN_SECTOR_LIFTS = 5;

// The generator names untagged OSM pistes "Slope (blue)" etc.
const UNNAMED_SLOPE = /^Slope \(/;

/** Maps each node id to the index of its (undirected) connected component. */
function componentsOf(nodes) {
  const adj = new Map(nodes.map(n => [n.id, []]));
  for (const n of nodes) {
    for (const c of n.connections) {
      adj.get(n.id).push(c.to);
      adj.get(c.to)?.push(n.id);
    }
  }
  const compOf = new Map();
  let index = 0;
  for (const n of nodes) {
    if (compOf.has(n.id)) continue;
    const stack = [n.id];
    compOf.set(n.id, index);
    while (stack.length) {
      for (const next of adj.get(stack.pop()) ?? []) {
        if (!compOf.has(next)) { compOf.set(next, index); stack.push(next); }
      }
    }
    index++;
  }
  return compOf;
}

/**
 * Returns one entry per resort, in data/resorts.json order:
 *   { resort, lifts: [{ name, liftType }], slopes: { green: [name], … }, unnamedSlopes }
 * Lifts and slope names are de-duplicated (a piste split by routing junctions
 * is many edges but one slope) and sorted alphabetically.
 */
export function buildReference(network, resorts) {
  const nodes = network.nodes;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const compOf = componentsOf(nodes);

  // Find self-contained sectors and the resort each one belongs to.
  const members = new Map();
  for (const n of nodes) {
    const comp = compOf.get(n.id);
    if (!members.has(comp)) members.set(comp, []);
    members.get(comp).push(n);
  }
  const largest = [...members.keys()].reduce((a, b) => members.get(b).length > members.get(a).length ? b : a);
  const sectorOwner = new Map();
  for (const [comp, list] of members) {
    if (comp === largest) continue;
    const lifts = list.filter(n => n.connections.some(c => c.type === 'lift')).length;
    if (lifts < MIN_SECTOR_LIFTS) continue;
    const lat = list.reduce((s, n) => s + n.lat, 0) / list.length;
    const lon = list.reduce((s, n) => s + n.lon, 0) / list.length;
    sectorOwner.set(comp, nearestResort(lat, lon, resorts).resort);
  }
  const ownedSlugs = new Set([...sectorOwner.values()].map(r => r.slug));
  const openResorts = resorts.filter(r => !ownedSlugs.has(r.slug));

  function place(lat, lon, country, comp) {
    if (sectorOwner.has(comp)) return sectorOwner.get(comp);
    const sameCountry = openResorts.filter(r => r.country === country);
    return nearestResort(lat, lon, sameCountry.length ? sameCountry : openResorts).resort;
  }

  const entries = new Map(resorts.map(r => [r.slug, {
    resort: r,
    lifts: new Map(),
    slopes: Object.fromEntries(SLOPE_DIFFICULTIES.map(d => [d, new Set()])),
    unnamed: new Set(),
  }]));

  for (const n of nodes) {
    for (const c of n.connections) {
      if (c.type === 'lift') {
        const entry = entries.get(place(n.lat, n.lon, n.country, compOf.get(n.id)).slug);
        entry.lifts.set(`${c.name}|${n.lift_type}`, { name: c.name, liftType: n.lift_type });
        continue;
      }
      const to = byId.get(c.to);
      const entry = entries.get(place(
        (n.lat + to.lat) / 2, (n.lon + to.lon) / 2, n.country, compOf.get(n.id),
      ).slug);
      if (UNNAMED_SLOPE.test(c.name)) {
        // Count each unnamed edge once, whichever direction it was listed in.
        entry.unnamed.add([n.id, c.to].sort().join('|'));
      } else {
        entry.slopes[c.difficulty]?.add(c.name);
      }
    }
  }

  const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  return [...entries.values()].map(e => ({
    resort: e.resort,
    lifts: [...e.lifts.values()].sort((a, b) => byName(a.name, b.name)),
    slopes: Object.fromEntries(SLOPE_DIFFICULTIES.map(d => [d, [...e.slopes[d]].sort(byName)])),
    unnamedSlopes: e.unnamed.size,
  }));
}
