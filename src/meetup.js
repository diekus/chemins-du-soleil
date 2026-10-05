import { findRoutes } from './pathfinder.js';
import { haversineKm, nodesByDistance } from './geo.js';

/**
 * Location sharing ("Meet up"): one person shares a link carrying their
 * position, the other opens it and gets a route from the lift nearest them
 * to that position. There's no server — the position travels only inside
 * the link itself, as "#meet?lat=..&lon=..&t=..".
 */

// ~1 m of precision is plenty — node coordinates are only approximate anyway.
const COORD_DECIMALS = 5;

// The receiver starts from one of their nearest lift bases, the route ends
// at one of the nodes nearest the shared spot. Several candidates of each
// are tried because the very nearest one may sit in a self-contained
// sub-graph (Roc d'Enfer, La Chapelle-d'Abondance) or not connect at the
// chosen maximum difficulty.
const START_CANDIDATES = 5;
const END_CANDIDATES   = 3;
const END_MAX_KM       = 0.3;

// Closer than this, the receiver is effectively already there.
export const ALREADY_THERE_KM = 0.1;

/** Builds the shareable link for a position, relative to `baseUrl` (the app's own URL). */
export function buildMeetUrl(baseUrl, lat, lon, time = Date.now()) {
  const url = new URL(baseUrl);
  const params = new URLSearchParams({
    lat: lat.toFixed(COORD_DECIMALS),
    lon: lon.toFixed(COORD_DECIMALS),
    t:   String(Math.round(time)),
  });
  url.hash = `meet?${params}`;
  return url.toString();
}

/** Parses a "#meet?..." hash's params into { lat, lon, time }, or null if malformed. */
export function parseMeetParams(params) {
  const lat  = Number(params.get('lat'));
  const lon  = Number(params.get('lon'));
  const time = Number(params.get('t'));
  if (!params.has('lat') || !params.has('lon')) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, time: Number.isFinite(time) && time > 0 ? time : null };
}

/**
 * Finds routes from the lift base nearest `from` to the node nearest `to`
 * (both { lat, lon }). Returns:
 *   { status: 'already-there' }                       — from is right next to to
 *   { status: 'at-start', startId }                   — to is at the lift nearest from
 *   { status: 'ok', startId, endId, routes }          — routes may be [] if none connect
 */
export function findMeetupRoutes(graph, nodes, from, to, maxDifficulty, preference = null) {
  if (haversineKm(from.lat, from.lon, to.lat, to.lon) <= ALREADY_THERE_KM) {
    return { status: 'already-there' };
  }

  const connected = connectedIds(graph);
  const starts = nodesByDistance(from.lat, from.lon, nodes,
    n => n.station_type === 'lift-base' && (graph.get(n.id)?.length ?? 0) > 0)
    .slice(0, START_CANDIDATES);
  // Any node type can be the end — the shared spot is as likely to be
  // mid-piste (a junction) as at a lift.
  const ends = nodesByDistance(to.lat, to.lon, nodes, n => connected.has(n.id))
    .filter((c, i) => i === 0 || c.km <= END_MAX_KM)
    .slice(0, END_CANDIDATES);

  for (const end of ends) {
    for (const start of starts) {
      if (start.node.id === end.node.id) return { status: 'at-start', startId: start.node.id };
      const routes = findRoutes(graph, start.node.id, end.node.id, maxDifficulty, 3, preference);
      if (routes.length > 0) {
        return { status: 'ok', startId: start.node.id, endId: end.node.id, routes };
      }
    }
  }

  return {
    status:  'ok',
    startId: starts[0]?.node.id ?? null,
    endId:   ends[0]?.node.id ?? null,
    routes:  [],
  };
}

/** Ids of every node with at least one edge leading to or from it. */
function connectedIds(graph) {
  const ids = new Set();
  for (const [id, edges] of graph) {
    if (edges.length > 0) ids.add(id);
    for (const e of edges) ids.add(e.to);
  }
  return ids;
}
