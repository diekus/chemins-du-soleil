#!/usr/bin/env node
/**
 * Generates data/network.json from data/portes_du_soleil_graph.json (OSM/Overpass).
 *
 * Model v3: piste endpoints are first-class nodes clustered by spatial proximity.
 * This lets routes chain multiple slopes together at junction nodes, not just
 * traverse lift → slope → lift.
 *
 * Node types:
 *   lift-base / lift-top  : OSM lift stations (searchable in UI)
 *   junction              : clustered piste endpoints (routing-only, hidden from search)
 *   village               : named resort access points
 *
 * Edge types:
 *   lift  : lift-base → lift-top
 *   slope : cluster(piste.start) → cluster(piste.end)
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC          = join(__dirname, '../data/portes_du_soleil_graph.json');
const RESORTS_SRC  = join(__dirname, '../data/resorts.json');
const OUT          = join(__dirname, '../data/network.json');

const { lifts, pistes, edges: osmEdges } = JSON.parse(readFileSync(SRC, 'utf8'));
const { resorts } = JSON.parse(readFileSync(RESORTS_SRC, 'utf8'));
const resortBySlug = new Map(resorts.map(r => [r.slug, r]));

// ── Corrections from the official resort map ─────────────────────────────────
// Checked against the Portes du Soleil interactive map (winter.intermaps.com/
// portes_du_soleil, data feed /portes_du_soleil/data, 2026-11). Each feature
// there was placed geographically from its panorama SVG position (fitted on
// ~120 name-matched lift stations, median error ~160 m) and paired with an OSM
// way only where there's exactly one same-named way close by. Pistes the
// official map splits into variants (e.g. "Chermillon Bleu" / "Chermillon
// Supérieure") or where OSM has several same-named ways in different colours
// are left alone: there's no single way to correct. Applied in memory, so
// data/portes_du_soleil_graph.json stays a raw OSM extract.
//
// Official colour wins over OSM's piste:difficulty (French scale: Très facile
// = green, Facile = blue, Difficile = red, Très difficile = black).
const PISTE_DIFFICULTY_CORRECTIONS = {
  // Avoriaz
  30481274:   'easy',          // Blanchots — official blue (OSM red)
  763210751:  'easy',          // Retour Chavanette — official blue (OSM green)
  23657268:   'intermediate',  // Portes du Soleil — official red (OSM blue)
  // Châtel
  800472191:  'easy',          // Douanier — official blue (OSM green)
  800472192:  'easy',          // Douanier — official blue (OSM green)
  45726069:   'intermediate',  // Tour de Don — official red (OSM blue)
  403535675:  'easy',          // Lac Léman — official blue (OSM red)
  // Les Gets
  32310289:   'easy',          // Choucas — official blue (OSM green)
  // Morzine
  693010445:  'easy',          // Bouchet — official blue (OSM green)
  693010446:  'easy',          // Bouchet — official blue (OSM green)
  // Abondance
  387311517:  'easy',          // Retour Village — official blue (OSM red)
};
// OSM names both Cuboré chairlifts plain "Cuboré" (same CAIRN ref); the
// official map tells them apart by the side they climb from. 29285756 is the
// one the "Cuboré Montriond" piste ends at.
const LIFT_NAME_CORRECTIONS = {
  29285752: 'Cuboré Avoriaz',
  29285756: 'Cuboré Montriond',
};
for (const p of pistes) {
  if (PISTE_DIFFICULTY_CORRECTIONS[p.id]) p.difficulty = PISTE_DIFFICULTY_CORRECTIONS[p.id];
}
for (const l of lifts) {
  if (LIFT_NAME_CORRECTIONS[l.id]) l.name = LIFT_NAME_CORRECTIONS[l.id];
}
{
  const missing = [
    ...Object.keys(PISTE_DIFFICULTY_CORRECTIONS).filter(id => !pistes.some(p => String(p.id) === id)),
    ...Object.keys(LIFT_NAME_CORRECTIONS).filter(id => !lifts.some(l => String(l.id) === id)),
  ];
  if (missing.length) throw new Error(`Corrections reference OSM ids not in the source: ${missing.join(', ')}`);
}

// ── Config ────────────────────────────────────────────────────────────────────

const PISTE_CLUSTER_RADIUS_M = 75;   // piste endpoints within this distance share a junction
const AUTO_BRIDGE_RADIUS_M   = 400;  // lift-top → lift-base gap filler (smaller than before
                                     // because junctions handle most within-resort connectivity)

// Mid-piste junctions (needs `geometry`, from scripts/enrich-osm-source.js):
// OSM pistes routinely end *on* another piste part-way along it, or run past
// a lift station without ending there. Endpoint clustering alone can't see
// either, so those pistes are split at the touching vertex.
const T_JUNCTION_RADIUS_M    = 25;   // another piste's endpoint this close to a piste's line joins it
const MID_STATION_RADIUS_M   = 50;   // a lift station this close to a piste's line is served by it
const END_EXCLUSION_M        = 40;   // ...unless it's at the piste's own ends (endpoint clustering covers those)

// Direction (needs `elev_*`, also from enrich-osm-source.js): a piste whose
// ends differ by at least this much runs downhill, regardless of how the OSM
// way was drawn. Below it, the lift-proximity evidence below decides, and a
// flat `connection` (a link path) is usable both ways.
const DOWNHILL_MIN_DROP_M    = 15;
// Auto-bridges are skied, so they mustn't climb more than DEM noise.
const AUTO_BRIDGE_MAX_CLIMB_M = 10;

const EXCLUDED_RESORTS = new Set(['Champoussin']); // too isolated to add value
const SWISS_RESORTS    = new Set(['Champery', 'Les Crosets', 'Morgins']);

// ── Mappings ──────────────────────────────────────────────────────────────────

const DIFF = {
  novice: 'green', easy: 'blue', intermediate: 'red',
  advanced: 'black', expert: 'black', freeride: 'black',
};
const LIFT_TYPE = {
  chair_lift: 'chairlift', gondola: 'gondola', cable_car: 'gondola',
  platter: 'surface', 't-bar': 'surface', drag_lift: 'surface',
  rope_tow: 'surface', magic_carpet: 'surface',
};

function mapDiff(d)     { return DIFF[d] ?? 'blue'; }
function mapCountry(r)  { return SWISS_RESORTS.has(r) ? 'CH' : 'FR'; }
function mapLiftType(t) { return LIFT_TYPE[t] ?? 'chairlift'; }
function liftBaseId(id) { return `lift_${id}_base`; }
function liftTopId(id)  { return `lift_${id}_top`;  }

function haversine(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

// ── Union-Find ────────────────────────────────────────────────────────────────

class UF {
  constructor() {
    this.p = new Map(); this.rank = new Map();
    // Lift-station pairs whose clusters touched but weren't merged (see union);
    // linked by short traverses in "Lift-station interchanges" below.
    this.interchanges = [];
  }
  add(id)       { if (!this.p.has(id)) { this.p.set(id, id); this.rank.set(id, 0); } }
  find(id) {
    if (this.p.get(id) !== id) this.p.set(id, this.find(this.p.get(id)));
    return this.p.get(id);
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    const aIsLift = ra.startsWith('lift_'), bIsLift = rb.startsWith('lift_');
    // Never merge two different lift station clusters — each lift node stays
    // distinct — but remember they meet here: the piste endpoints between them
    // can only join one of the two, which would otherwise strand the other.
    if (aIsLift && bIsLift) { this.interchanges.push([ra, rb]); return; }
    // Lift station wins: piste endpoints absorb into the lift cluster
    if (aIsLift) { this.p.set(rb, ra); return; }
    if (bIsLift) { this.p.set(ra, rb); return; }
    // Both are piste endpoints — rank-based merge
    if (this.rank.get(ra) >= this.rank.get(rb)) {
      this.p.set(rb, ra);
      if (this.rank.get(ra) === this.rank.get(rb)) this.rank.set(ra, this.rank.get(ra) + 1);
    } else {
      this.p.set(ra, rb);
    }
  }
}

// ── Prepare data ──────────────────────────────────────────────────────────────

const usedLifts    = lifts.filter(l => !EXCLUDED_RESORTS.has(l.resort_nearest));
const usedLiftIds  = new Set(usedLifts.map(l => l.id));
const liftsById    = new Map(lifts.map(l => [l.id, l]));
const pistesById   = new Map(pistes.map(p => [p.id, p]));

// Spatial data for all points
const liftPts  = new Map(); // nodeId → {lat,lon}
const pistePts = new Map(); // nodeId → {lat,lon,pisteId}

for (const lift of usedLifts) {
  liftPts.set(liftBaseId(lift.id), { lat: lift.base_station.lat, lon: lift.base_station.lon });
  liftPts.set(liftTopId(lift.id),  { lat: lift.top_station.lat,  lon: lift.top_station.lon  });
}

for (const piste of pistes) {
  if (!piste.start?.lat || !piste.end?.lat) continue;
  pistePts.set(`piste_${piste.id}_start`, { lat: piste.start.lat, lon: piste.start.lon, pisteId: piste.id, elev: piste.elev_start ?? null });
  pistePts.set(`piste_${piste.id}_end`,   { lat: piste.end.lat,   lon: piste.end.lon,   pisteId: piste.id, elev: piste.elev_end ?? null });
}

// ── Build Union-Find ──────────────────────────────────────────────────────────

const uf = new UF();
for (const id of liftPts.keys())  uf.add(id);
for (const id of pistePts.keys()) uf.add(id);

// Step 1: merge lift stations with nearby piste endpoints (from OSM proximity edges)
// A piste end near several stations joins the nearest one (merge order would
// otherwise decide, e.g. sending the Zore pistes to Zore's base 76 m away
// instead of Super-Morzine's top 22 m away); the others are recorded as
// interchanges with it.
{
  const nearby = new Map(); // piste endpoint → Set(lift station)
  for (const e of osmEdges) {
    if (!usedLiftIds.has(e.lift_id)) continue;
    const liftId = e.lift_station === 'top' ? liftTopId(e.lift_id) : liftBaseId(e.lift_id);
    const pistId = e.piste_end   === 'start' ? `piste_${e.piste_id}_start` : `piste_${e.piste_id}_end`;
    if (!pistePts.has(pistId)) continue;
    if (!nearby.has(pistId)) nearby.set(pistId, new Set());
    nearby.get(pistId).add(liftId);
  }
  const dist = (pistId, station) => haversine(pistePts.get(pistId), liftPts.get(station));
  const ranked = new Map(); // piste endpoint → its nearby stations, nearest first
  for (const [pistId, stations] of nearby) {
    ranked.set(pistId, [...stations].sort((a, b) => dist(pistId, a) - dist(pistId, b)));
  }
  // Both ends of one piste must not join the same station (the piste would
  // collapse to nothing): the end farther from it gives up that station and,
  // if it has no other, is left to the endpoint clustering in step 2.
  for (const [pistId, list] of ranked) {
    if (!pistId.endsWith('_start')) continue;
    const endId = pistId.replace(/_start$/, '_end');
    const endList = ranked.get(endId);
    if (!list.length || !endList?.length || list[0] !== endList[0]) continue;
    if (dist(pistId, list[0]) <= dist(endId, endList[0])) endList.shift();
    else list.shift();
  }
  for (const [pistId, [nearest, ...others]] of ranked) {
    if (!nearest) continue;
    uf.union(nearest, pistId);
    for (const other of others) uf.interchanges.push([nearest, other]);
  }
}

// Step 2: merge piste endpoints that are within PISTE_CLUSTER_RADIUS_M of each other
// O(n²) over 1736 points — ~1.5 M comparisons, fast enough at this scale
const pisteArr = [...pistePts.entries()];
for (let i = 0; i < pisteArr.length; i++) {
  const [idA, ptA] = pisteArr[i];
  for (let j = i + 1; j < pisteArr.length; j++) {
    const [idB, ptB] = pisteArr[j];
    if (haversine(ptA, ptB) <= PISTE_CLUSTER_RADIUS_M) uf.union(idA, idB);
  }
}

// Step 3: mid-piste junctions. For each piste with a full polyline, find the
// other pistes' endpoints and the lift stations that touch it part-way along,
// and add a split point there (merged with whatever touches it). Splits are
// ordered by distance along the piste so its edges can be chained below.
const splitsOf = new Map(); // piste id → [{ key, s }] sorted by s (metres along the piste)
{
  // Local flat projection: fine at the few-hundred-metre scale of one piste.
  const M_PER_DEG_LAT = 111_320;
  const endpointPts = [...pistePts.entries()];
  const stationPts  = [...liftPts.entries()];

  for (const piste of pistes) {
    const g = piste.geometry;
    if (!g || g.length < 2) continue;
    const mLon = M_PER_DEG_LAT * Math.cos(g[0][0] * Math.PI / 180);
    const xy  = g.map(([lat, lon]) => [lon * mLon, lat * M_PER_DEG_LAT]);
    const cum = [0];
    for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
    const total = cum[cum.length - 1];
    if (total < 2 * END_EXCLUSION_M) continue;
    const pad = MID_STATION_RADIUS_M / M_PER_DEG_LAT * 1.5;
    const lats = g.map(p => p[0]), lons = g.map(p => p[1]);
    const box = [Math.min(...lats) - pad, Math.max(...lats) + pad, Math.min(...lons) - pad * 1.5, Math.max(...lons) + pad * 1.5];

    // Distance from a point to the polyline, and where along it that falls.
    function locate(pt) {
      const q = [pt.lon * mLon, pt.lat * M_PER_DEG_LAT];
      let best = { d: Infinity, s: 0, lat: 0, lon: 0 };
      for (let i = 0; i < xy.length - 1; i++) {
        const [ax, ay] = xy[i], [bx, by] = xy[i + 1];
        const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
        const t = len2 ? Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / len2)) : 0;
        const d = Math.hypot(ax + t * dx - q[0], ay + t * dy - q[1]);
        if (d < best.d) best = { d, s: cum[i] + t * Math.sqrt(len2), lat: (ay + t * dy) / M_PER_DEG_LAT, lon: (ax + t * dx) / mLon };
      }
      return best;
    }

    const hits = [];
    const consider = (id, pt, radius) => {
      if (pt.lat < box[0] || pt.lat > box[1] || pt.lon < box[2] || pt.lon > box[3]) return;
      const at = locate(pt);
      if (at.d <= radius && at.s >= END_EXCLUSION_M && total - at.s >= END_EXCLUSION_M) hits.push({ id, ...at });
    };
    for (const [id, pt] of endpointPts) if (pt.pisteId !== piste.id) consider(id, pt, T_JUNCTION_RADIUS_M);
    for (const [id, pt] of stationPts) consider(id, pt, MID_STATION_RADIUS_M);
    if (!hits.length) continue;

    // Hits close together along the piste share one split point.
    hits.sort((a, b) => a.s - b.s);
    const splits = [];
    for (const h of hits) {
      const last = splits[splits.length - 1];
      if (last && h.s - last.s <= PISTE_CLUSTER_RADIUS_M) { uf.union(last.key, h.id); continue; }
      const key = `piste_${piste.id}_s${splits.length}`;
      // No DEM sample at a split point: interpolate between the piste's ends by
      // distance along it — a straight-line gradient, so approximate.
      const elev = piste.elev_start != null && piste.elev_end != null
        ? piste.elev_start + (piste.elev_end - piste.elev_start) * (h.s / total)
        : null;
      pistePts.set(key, { lat: h.lat, lon: h.lon, pisteId: piste.id, elev });
      uf.add(key);
      uf.union(key, h.id);
      splits.push({ key, s: h.s });
    }
    splitsOf.set(piste.id, splits);
  }
}

// ── Determine piste direction from OSM edge evidence ──────────────────────────
// 'top_start' or 'base_end' confirm the way direction is downhill (start→end).
// 'top_end'   suggests the way is reversed.  We use this to correct edges.

const pisteDir = new Map(); // piste_id → 'correct' | 'reversed'
for (const e of osmEdges) {
  if (!usedLiftIds.has(e.lift_id)) continue;
  if (e.lift_station === 'top'  && e.piste_end === 'start') pisteDir.set(e.piste_id, 'correct');
  if (e.lift_station === 'base' && e.piste_end === 'end')   pisteDir.set(e.piste_id, 'correct');
  if (e.lift_station === 'top'  && e.piste_end === 'end' && !pisteDir.has(e.piste_id))
    pisteDir.set(e.piste_id, 'reversed');
}

/** 'correct' (start → end), 'reversed', or 'both' — elevation first, OSM evidence as fallback. */
function directionOf(piste) {
  if (piste.elev_start != null && piste.elev_end != null) {
    const drop = piste.elev_start - piste.elev_end;
    if (drop >= DOWNHILL_MIN_DROP_M)  return 'correct';
    if (-drop >= DOWNHILL_MIN_DROP_M) return 'reversed';
    if (piste.piste_type === 'connection') return 'both';
  }
  return pisteDir.get(piste.id) ?? 'correct';
}

// ── Build node and connection maps ───────────────────────────────────────────

const nodeConns = new Map(); // nodeId (rep) → connection[]

function ensureNode(id) {
  if (!nodeConns.has(id)) nodeConns.set(id, []);
  return nodeConns.get(id);
}

// Initialise all cluster representatives
for (const id of liftPts.keys())  ensureNode(uf.find(id));
for (const id of pistePts.keys()) ensureNode(uf.find(id));

// ── Lift edges ────────────────────────────────────────────────────────────────

const seenEdges = new Set();

function addEdge(fromRep, toRep, name, type, difficulty) {
  const key = `${fromRep}→${toRep}→${name}`;
  if (seenEdges.has(key)) return false;
  seenEdges.add(key);
  ensureNode(fromRep).push({ to: toRep, name, type, difficulty });
  return true;
}

for (const lift of usedLifts) {
  const baseRep = uf.find(liftBaseId(lift.id));
  const topRep  = uf.find(liftTopId(lift.id));
  if (baseRep === topRep) continue; // shouldn't happen but guard it
  addEdge(baseRep, topRep, lift.name ?? `Lift ${lift.id}`, 'lift', 'silver');
}

// ── Piste (slope) edges ───────────────────────────────────────────────────────

for (const piste of pistes) {
  if (!piste.start?.lat || !piste.end?.lat) continue;

  // The piste as a chain of cluster reps: start → any mid-piste splits → end.
  const chain = [`piste_${piste.id}_start`, ...(splitsOf.get(piste.id) ?? []).map(s => s.key), `piste_${piste.id}_end`]
    .map(k => uf.find(k))
    .filter((rep, i, arr) => i === 0 || rep !== arr[i - 1]);
  if (chain.length < 2) continue; // piste too short / collapsed into one cluster

  const dir = directionOf(piste);
  if (dir === 'reversed') chain.reverse();

  const difficulty = mapDiff(piste.difficulty);
  const name       = piste.name ?? `Slope (${difficulty})`;
  for (let i = 0; i < chain.length - 1; i++) {
    addEdge(chain[i], chain[i + 1], name, 'slope', difficulty);
    if (dir === 'both') addEdge(chain[i + 1], chain[i], name, 'slope', difficulty);
  }
}

// ── Lift-station interchanges ─────────────────────────────────────────────────
// Where piste endpoints cluster around two (or more) lift stations — e.g. the
// Zore and Tétras pistes ending between Zore's base and Super-Morzine's top,
// 88 m apart — Union-Find can attach them to only one station, leaving the
// other with no way in or out. Link each such pair with a short traverse,
// downhill or flat only (same climb limit as the auto-bridges below), so a
// lift's top is never "skied" back up to its own or another station.
const INTERCHANGE_MAX_M = 300; // sanity cap: observed pairs are all ≤ ~260 m

function stationInfo(rep) {
  const m = rep.match(/^lift_(\d+)_(base|top)$/);
  const lift = m && liftsById.get(Number(m[1]));
  if (!lift) return null;
  return {
    name: lift.name ?? `Lift ${lift.id}`,
    pt:   m[2] === 'base' ? lift.base_station : lift.top_station,
    elev: m[2] === 'base' ? lift.elev_base    : lift.elev_top,
  };
}

let interchangeLinks = 0;
{
  const seen = new Set();
  for (const [a, b] of uf.interchanges) {
    const key = [a, b].sort().join('|');
    if (a === b || seen.has(key)) continue;
    seen.add(key);
    const A = stationInfo(a), B = stationInfo(b);
    if (!A || !B || haversine(A.pt, B.pt) > INTERCHANGE_MAX_M) continue;
    const climbOk = (from, to) => from.elev == null || to.elev == null
      || to.elev - from.elev <= AUTO_BRIDGE_MAX_CLIMB_M;
    if (climbOk(A, B) && addEdge(a, b, `Traverse to ${B.name}`, 'slope', 'green')) interchangeLinks++;
    if (climbOk(B, A) && addEdge(b, a, `Traverse to ${A.name}`, 'slope', 'green')) interchangeLinks++;
  }
}
console.log(`  → Linked ${interchangeLinks} lift-station interchange traverses`);

// ── Manual cross-sector edges ─────────────────────────────────────────────────
// These cover gaps where the OSM 100 m proximity radius doesn't reach across
// resort boundaries. 'from'/'to' use lift_${id}_top/base (which are cluster reps
// since lift stations always win Union-Find priority).

const CROSS_SECTOR = [
  // ── Morzine village → Avoriaz ─────────────────────────────────────────────
  { from: 'morzine-village', to: liftBaseId(225288644),
    name: 'Transfer to Les Prodains', type: 'slope', difficulty: 'green' },
  { from: 'morzine-village', to: liftBaseId(32425248),
    name: 'Access to Nyon cable car',  type: 'slope', difficulty: 'green' },
  { from: liftBaseId(32312982), to: 'morzine-village',
    name: 'Descent to Morzine',        type: 'slope', difficulty: 'green' },

  // ── Avoriaz → Swiss border ────────────────────────────────────────────────
  // Cases (750062609) top → Grand Conche (CH, 8216408) base: blue Les Crosets bowl
  { from: liftTopId(750062609), to: liftBaseId(8216408),
    name: 'Les Crosets crossover', type: 'slope', difficulty: 'blue' },
  { from: liftTopId(750062609), to: liftBaseId(8215671),
    name: 'Mossettes crossover',   type: 'slope', difficulty: 'blue' },
  // Grandes Combes (24916425) top → Les Crosets bowl
  { from: liftTopId(24916425), to: liftBaseId(8216408),
    name: 'Les Crosets via Grandes Combes', type: 'slope', difficulty: 'blue' },
  // Mossettes Avoriaz (8216510) top → Mossettes Champery base (red crossing)
  { from: liftTopId(8216510), to: liftBaseId(8215671),
    name: 'Pas de la Mossette', type: 'slope', difficulty: 'red' },
  // Chavanette drag lifts → Swiss Wall (expert)
  { from: liftTopId(30482077), to: liftBaseId(8216408),
    name: 'Pas de Chavanette', type: 'slope', difficulty: 'black' },
  { from: liftTopId(24916408), to: liftBaseId(8216408),
    name: 'Pas de Chavanette', type: 'slope', difficulty: 'black' },

  // ── Swiss summit → lower Les Crosets / Champéry ──────────────────────────
  // Grand Conche (CH) top (Pointe des Mossettes) → various lower Swiss lifts
  { from: liftTopId(8216408), to: liftBaseId(8215532),
    name: 'Descente Les Crosets',   type: 'slope', difficulty: 'blue'  },
  { from: liftTopId(8216408), to: liftBaseId(8216350),
    name: 'Traverse to Marcheuson', type: 'slope', difficulty: 'green' },
  { from: liftTopId(8216408), to: liftBaseId(8215630),
    name: 'Descente Grand Conche',  type: 'slope', difficulty: 'blue'  },
  // Mossettes (CH) top → lower Swiss area
  { from: liftTopId(8215671), to: liftBaseId(8215532),
    name: 'Descente Les Crosets',   type: 'slope', difficulty: 'blue'  },
  { from: liftTopId(8215671), to: liftBaseId(8215584),
    name: 'Descente Champéry',      type: 'slope', difficulty: 'blue'  },

  // ── Swiss side → Avoriaz (return) ────────────────────────────────────────
  { from: liftTopId(8216408), to: liftBaseId(29285752),
    name: 'Vautna Noire',   type: 'slope', difficulty: 'black' },
  { from: liftTopId(8215671), to: liftBaseId(750062609),
    name: 'Retour Avoriaz', type: 'slope', difficulty: 'red'   },

  // ── Champéry village node ─────────────────────────────────────────────────
  { from: liftTopId(8215584),  to: 'champery', name: 'Descent to Champéry', type: 'slope', difficulty: 'blue'  },
  { from: liftTopId(8215630),  to: 'champery', name: 'Descent to Champéry', type: 'slope', difficulty: 'green' },
  { from: liftTopId(29283986), to: 'champery', name: 'Descent to Champéry', type: 'slope', difficulty: 'blue'  },
  { from: liftTopId(49397555), to: 'champery', name: 'Gueilly to Champéry', type: 'slope', difficulty: 'blue'  },
  { from: 'champery', to: liftBaseId(8215584), name: 'Access Pauvre Conche',    type: 'slope', difficulty: 'green' },
  { from: 'champery', to: liftBaseId(8215630), name: 'Access Ripaille',          type: 'slope', difficulty: 'green' },
  { from: 'champery', to: liftBaseId(8216335), name: 'Access cable car',         type: 'slope', difficulty: 'green' },
];

// ── Saint-Jean-d'Aulps village access ─────────────────────────────────────────
// The village itself isn't an OSM piste/lift node, so its walk-in link to the
// gondola base is specified manually — same treatment as morzine-village and
// champery below. All other Roc d'Enfer connectivity (both the Saint-Jean-
// d'Aulps and La Chèvrerie sectors, lift-linked via Col de Graydon/Col des
// Follys) comes from real OSM piste geometry through the standard clustering
// pipeline, same as every other resort.
const SJA_SECTOR = [
  { from: 'saint-jean-daulps', to: liftBaseId(23275859),
    name: "Access Grande Terche gondola", type: 'slope', difficulty: 'green' },
  { from: liftBaseId(23275859), to: 'saint-jean-daulps',
    name: "Return to Saint-Jean-d'Aulps", type: 'slope', difficulty: 'green' },

  // Têtes summit → Chargeau/Graydon sector: OSM has no piste geometry tracing
  // this ~500-550m descent (matches map pistes #2 "Les Têtes" red / #10
  // "Chargeau" red), so junction clustering can't bridge it automatically.
  { from: liftTopId(378209423), to: liftBaseId(288892180),
    name: 'Descent to Chargeau', type: 'slope', difficulty: 'blue' },
  { from: liftTopId(378209423), to: liftBaseId(288893232),
    name: 'Descent to Graydon',  type: 'slope', difficulty: 'red'  },

  // Follys 1 and Follys 2 are twin drag lifts ~12m apart at Col des Follys —
  // effectively the same physical point, but lift-station clusters never
  // merge with each other, so Follys 2's arrivals can't reach the pistes
  // already wired from Follys 1's top.
  { from: liftTopId(315824149), to: liftTopId(383430774),
    name: 'Col des Follys', type: 'slope', difficulty: 'green' },
  { from: liftTopId(383430774), to: liftTopId(315824149),
    name: 'Col des Follys', type: 'slope', difficulty: 'green' },

  // La Chèvrerie is one shared base area/car park (~580m across, below the
  // OSM-piste-tracing gap threshold) serving Torchon plus the beginner
  // cluster (Cabri/École 1/École 2/Étangs) — a flat walk, not a piste run.
  { from: liftBaseId(315824148), to: liftBaseId(317021227),
    name: 'La Chèvrerie', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(317021227), to: liftBaseId(315824148),
    name: 'La Chèvrerie', type: 'slope', difficulty: 'green' },
];

// ── Ardent ↔ Châtel (Rochassons / Linga) corridor ─────────────────────────────
// Real-world route confirmed against Avoriaz's own trip-planning guide and
// Châtel resort documentation (Ardent → Chaux Fleurie lift in Lindarets →
// Rochassons lift → Plaine Dranse → Pierre Longue lift → Pré la Joux/Combes →
// Écho Alpin → Linga). OSM's piste tracing has gaps at each lift-to-lift
// crossing along this route; each gap below is bridged using verified lift
// station elevations (so direction is never guessed) and real-world distances
// consistent with the rest of the corridor's already-mapped pistes.
const CHATEL_SECTOR = [
  // Chaux Fleurie summit (1912m) → Rochassons base (1642m): the "Plaine
  // Dranse" descent — OSM has no piste geometry spanning this ~770m drop.
  { from: liftTopId(24916433), to: liftBaseId(8215843),
    name: 'Descent to Rochassons', type: 'slope', difficulty: 'red' },

  // Combes summit (2061m) → Écho Alpin summit (2035m): a ~410m ridge
  // traverse linking the Pré la Joux sector to the Linga sector — again
  // untraced in OSM, confirmed by Châtel's own sector documentation
  // ("Écho Alpin... connects to the Pré-la-Joux sector").
  { from: liftTopId(24916937), to: liftTopId(30749922),
    name: 'Traverse to Écho Alpin', type: 'slope', difficulty: 'blue' },

  // Linga and Stade (Chatel) bases are ~25m apart — the same shared-base-area
  // situation as La Chèvrerie above — but the one piste OSM does trace here
  // (`Le Linga`, Écho Alpin summit → this base area) clusters onto Stade's
  // base station instead of Linga's, since both are within the proximity
  // threshold. This keeps Linga itself reachable either way.
  { from: liftBaseId(1010800534), to: liftBaseId(30750444),
    name: 'Linga / Stade', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(30750444), to: liftBaseId(1010800534),
    name: 'Linga / Stade', type: 'slope', difficulty: 'green' },

  // Pierre Longue summit → Pierre Longue base: OSM does trace this piste
  // ("La Belette", the run back down to Pré la Joux under the lift line —
  // confirmed by Portes du Soleil's own lift description: "departs from
  // Pré la Joux... takes you directly to Plaine-Dranse"), but its endpoints
  // sit exactly on the Pierre Longue stations (0m) *and* within proximity of
  // two other lifts (Rochassons base 59m, Rubis base 84.5m). The clustering
  // pass's "never merge two different lift clusters" rule means whichever
  // lift's proximity edge is processed first in the OSM data wins the piste
  // endpoint, so it got attached to Rochassons/Rubis instead — leaving Pierre
  // Longue's own summit with no way down and stranding it from the rest of
  // the Ardent ↔ Châtel corridor above.
  { from: liftTopId(1009693206), to: liftBaseId(1009693206),
    name: 'La Belette', type: 'slope', difficulty: 'green' },

  // Vonnes: the Gabelou chairlift links Linga with Vonnes, where the Portes du
  // Soleil chairlift (55 m away) climbs to Super-Châtel. "A l'arrivée à
  // Vonnes, aucune piste n'est accessible, la seule remontée empruntable étant
  // le télésiège des Portes du Soleil", and Gabelou carries skiers "de Vonnes
  // au Linga et vice-versa" — it is "empruntable dans les deux sens"
  // (remontees-mecaniques.net/bdd/reportage-tsd4-du-gabelou-poma-5404.html).
  // OSM has only the Vonnes → Linga direction and no link between the two
  // bases, which left both lifts unreachable.
  { from: liftTopId(325533365), to: liftBaseId(325533365),
    name: 'Gabelou', type: 'lift', difficulty: 'silver' },
  { from: liftBaseId(325533365), to: liftBaseId(325533218),
    name: 'Access Portes du Soleil chairlift', type: 'slope', difficulty: 'green' },
];

// ── La Chapelle-d'Abondance: Panthiaz gondola ─────────────────────────────────
// The Panthiaz gondola climbs from just outside La Chapelle-d'Abondance
// village to the Braitaz/Torgon side of the domain, and no piste comes back to
// its base: "La redescente sur la station village s'effectue en empruntant la
// télécabine de la Panthiaz" (passionportesdusoleil.com/la-chapelle-dabondance).
// Same ride-down pattern as Petit Châtel; without it the base was unreachable.
const LA_CHAPELLE_SECTOR = [
  { from: liftTopId(31770794), to: liftBaseId(31770794),
    name: 'Panthiaz', type: 'lift', difficulty: 'silver' },

  // The Blanchot (from Braitaz's summit) and Marmotte pistes both end at the
  // start of OSM way 383420833, a short unnamed novice link that OSM traces on
  // to the head of the Belette and Chemin Rural pistes, which lead to the
  // Panthiaz summit. Its elevation data puts that far end 23 m higher, so the
  // generator reversed it, leaving the two pistes in a dead end and the
  // Panthiaz summit cut off from the domain. Keep OSM's direction.
  { from: 'piste_383420833_start', to: 'piste_383420833_end',
    name: 'Slope (green)', type: 'slope', difficulty: 'green' },
];

// ── Morgins connectivity ──────────────────────────────────────────────────────
// Two separate OSM-tracing gaps left Morgins-Foilleuse (the gondola from
// Morgins village) unable to reach the rest of Morgins' own lift network, and
// left Morgins unable to cross into Châtel at all.
const MORGINS_SECTOR = [
  // Foilleuse top's own descent (via Truche/Chaux/a short red run) ends 134m
  // from Bochasses base with no piste continuing from there in OSM — a real
  // gap, not a genuine dead end, since Bochasses is what the rest of Morgins'
  // lift network (Pointe de l'Au, Corbeau, Sepaya, etc.) hangs off of.
  { from: 'piste_8216118_end', to: liftBaseId(198298433),
    name: 'Traverse to Bochasses', type: 'slope', difficulty: 'blue' },

  // Champeys summit (1708 m) → Sépaya I summit (1695 m), 200 m apart at the
  // top of Champoussin. The Sépaya beginner piste starts at Sépaya I's summit
  // and runs down to the Sépaya I/II bases, which are "accessible only by
  // skiing" (regiondentsdumidi.ch/en/5402392-sepaya-i-drag-lift-50122). OSM's
  // short link piste between the two summits (way 29289836, a near-flat 9 m)
  // is traced only away from Sépaya, so nothing in the domain could reach
  // the Sépaya piste or lifts.
  { from: liftTopId(8216644), to: liftTopId(24899602),
    name: 'Traverse to Sépaya', type: 'slope', difficulty: 'green' },

  // Écottis summit (in Morgins' Corbeau sector) → Chalet Neuf 1 summit (Châtel):
  // OSM traces the reverse (Châtel → Morgins) direction of this border
  // crossing (Chalet Neuf top → Écottis base, already present below) but not
  // this one — confirmed by Portes du Soleil's own sector documentation:
  // "[Morgins'] Corbeau sector... allows the link with Châtel [via] the
  // Chalet Neuf drag lifts".
  { from: liftTopId(24898743), to: liftTopId(24899026),
    name: 'Traverse to Chalet Neuf', type: 'slope', difficulty: 'blue' },
];

// ── Morgins village transfer (Foilleuse sector ↔ Corbeau sector) ─────────────
// Same pattern as the Châtel village transfer below: Morgins' two sectors
// (Foilleuse — the gondola from the village centre — and Corbeau, ~500m away)
// share no lift or piste in OSM. Confirmed via Région Dents du Midi's own
// visitor info: "A shuttle bus runs between the two ski lifts (Corbeau and
// Foilleuse), every 10 minutes" and "When there is ample snow, it is possible
// to ski from the Corbeau, through the village, to the Foilleuse." Without
// this, the whole Corbeau sector (and everything beyond it, incl. the
// Châtel border crossing above) was unreachable from Morgins' own village
// gondola.
const MORGINS_VILLAGE_SECTOR = [
  { from: 'morgins-village', to: liftBaseId(8215989),
    name: 'Access Foilleuse gondola', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(8215989), to: 'morgins-village',
    name: 'Return to Morgins village', type: 'slope', difficulty: 'green' },
  { from: 'morgins-village', to: liftBaseId(24898742),
    name: 'Access Corbeau chairlift', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(24898742), to: 'morgins-village',
    name: 'Return to Morgins village', type: 'slope', difficulty: 'green' },
  // Espace du Géant, the beginner area (Géant and Snowly drag lifts) "located
  // in the village of Morgins" (valais.ch, Espace du Géant – zone de ski pour
  // débutants); OSM has no piste linking it to the rest of the network.
  { from: 'morgins-village', to: liftBaseId(151647586),
    name: 'Access Géant beginner area', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(151647586), to: 'morgins-village',
    name: 'Return to Morgins village', type: 'slope', difficulty: 'green' },
];

// ── Châtel village transfer (Linga/Pré-la-Joux sector ↔ Super-Châtel/Barbossine
// sector) ─────────────────────────────────────────────────────────────────────
// Châtel's own lift network is split into two sectors that don't share a lift
// or piste: Super-Châtel/Barbossine (reached by the gondola from the village
// centre) and Linga/Pré-la-Joux (reached by the Linga chairlift, ~1.8km from
// the village centre along the valley road). Skiers move between them via the
// village itself, exactly like the Morzine village transfers above — this was
// entirely missing (no 'chatel-village' node existed), which left the whole
// Super-Châtel/Barbossine sector (Morclan, Panthiaz, Corbeau, Coqs, Conches,
// Petit Châtel, etc.) disconnected from the rest of Portes du Soleil in the
// graph despite being reachable in reality. Confirmed via Châtel resort
// documentation: "the local Chatel ski area is split into two separate
// sectors: Super Chatel/Barbossine and Linga/Pre-la-Joux, the former accessed
// by a gondola directly from the centre of the village" and "[Linga] chairlift
// is located at the bottom of the resort, 1.8km from the village centre."
const CHATEL_VILLAGE_SECTOR = [
  { from: 'chatel-village', to: liftBaseId(24898714),
    name: 'Access Super-Châtel gondola', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(24898714), to: 'chatel-village',
    name: 'Return to Châtel village', type: 'slope', difficulty: 'green' },
  { from: 'chatel-village', to: liftBaseId(1010800534),
    name: 'Access Linga chairlift', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(1010800534), to: 'chatel-village',
    name: 'Return to Châtel village', type: 'slope', difficulty: 'green' },
  // Petit Châtel chairlift (from the Petit-Châtel hamlet up to Barbossine):
  // "no official piste comes back to Châtel, so the chairlift is open for the
  // descent" (haute-savoie-tourisme.org/334109-telesiege-du-petit-chatel).
  // Without it the lift's base was unreachable.
  { from: liftTopId(29289470), to: liftBaseId(29289470),
    name: 'Petit Châtel', type: 'lift', difficulty: 'silver' },
];

// ── Morzine village gondolas (Pléney ↔ Super-Morzine) ─────────────────────────
// Both gondolas leave from Morzine's village centre, on opposite sides of the
// valley — Pléney towards Les Gets, Super-Morzine towards Avoriaz — and share
// no lift or piste, so skiers cross between them through the village (OSM
// puts their bases ~570 m and ~660 m from the village centroid). Confirmed via
// Morzine-Avoriaz tourism's own lift pages (en.morzine-avoriaz.com/equipment/
// pleney-gondola, …/super-morzine-gondola) and ski-pass office listings
// ("by the Téléphérique du Pléney in the centre"; Super-Morzine "connects
// Morzine to Avoriaz from the centre of Morzine").
const MORZINE_VILLAGE_GONDOLAS = [
  { from: 'morzine-village', to: liftBaseId(30752181),
    name: 'Access Pléney gondola', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(30752181), to: 'morzine-village',
    name: 'Return to Morzine village', type: 'slope', difficulty: 'green' },
  { from: 'morzine-village', to: liftBaseId(53165460),
    name: 'Access Super-Morzine gondola', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(53165460), to: 'morzine-village',
    name: 'Return to Morzine village', type: 'slope', difficulty: 'green' },
  // There's no piste from Super-Morzine down to the village: skiers coming
  // back from Avoriaz (Zore/Tétras pistes → Super-Morzine top) ride the
  // gondola down — "you can get to Morzine by taking Zore chairlift and Super
  // Morzine cablecar" (en.morzine-avoriaz.com/routes/ridges-of-super-morzine-
  // and-lake-montriond-belvedere). Without it the main domain had no way back
  // into Morzine at all.
  { from: liftTopId(53165460), to: liftBaseId(53165460),
    name: 'Super-Morzine', type: 'lift', difficulty: 'silver' },
];

// ── Les Gets village transfer (Chavannes ↔ Mont Chéry) ────────────────────────
// Same pattern as Châtel/Morgins: Les Gets' two sectors — Chavannes (towards
// Morzine/Pléney) and Mont Chéry — each start with a gondola from the village
// (Chavannes 1170 m, Mont Chéry 1162 m; OSM bases 431 m apart) and share no
// lift or piste. Confirmed via Les Gets' own lift pages (explore.lesgets.com:
// "TC Chavannes… connecting the village platform", "Télécabine du Mont
// Chéry… connecting the village to Mont Chéry").
const LES_GETS_VILLAGE_SECTOR = [
  { from: 'les-gets-village', to: liftBaseId(49511429),
    name: 'Access Chavannes gondola', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(49511429), to: 'les-gets-village',
    name: 'Return to Les Gets village', type: 'slope', difficulty: 'green' },
  { from: 'les-gets-village', to: liftBaseId(49511436),
    name: 'Access Mont Chéry gondola', type: 'slope', difficulty: 'green' },
  { from: liftBaseId(49511436), to: 'les-gets-village',
    name: 'Return to Les Gets village', type: 'slope', difficulty: 'green' },
];

// Village node initialisation (ensure keys exist before manual edges are applied)
ensureNode('morzine-village');
ensureNode('les-gets-village');
ensureNode('champery');
ensureNode('saint-jean-daulps');
ensureNode('chatel-village');
ensureNode('morgins-village');

for (const e of [...CROSS_SECTOR, ...SJA_SECTOR, ...CHATEL_SECTOR, ...LA_CHAPELLE_SECTOR, ...MORGINS_SECTOR, ...MORGINS_VILLAGE_SECTOR, ...CHATEL_VILLAGE_SECTOR, ...MORZINE_VILLAGE_GONDOLAS, ...LES_GETS_VILLAGE_SECTOR]) {
  // Village nodes are not in UF — use their ID directly
  const fromRep = uf.find(e.from) ?? e.from;
  const toRep   = uf.find(e.to)   ?? e.to;
  const from = (fromRep === undefined || fromRep === e.from) ? e.from : fromRep;
  const to   = (toRep   === undefined || toRep   === e.to)   ? e.to   : toRep;
  addEdge(from, to, e.name, e.type, e.difficulty);
}

// ── Auto-bridge lift-to-lift gaps ─────────────────────────────────────────────
// Piste junctions now handle most within-resort connectivity, but a few lift
// tops may still be cut off from nearby lift bases. Bridge gaps ≤ threshold,
// but only where the top can't already reach that base: the graph is directed,
// so a lift you can ski *into* but not *out of* is just as stuck as one with
// no pistes at all — and a top that already reaches the base needs no shortcut.

function reachableFrom(start, conns) {
  const seen = new Set([start]), queue = [start];
  while (queue.length) {
    for (const e of conns.get(queue.pop()) ?? []) {
      if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
    }
  }
  return seen;
}

let bridgesAdded = 0, passes = 0, changed = true;
while (changed && passes < 10) {
  changed = false; passes++;
  for (const liftA of usedLifts) {
    const tRep  = uf.find(liftTopId(liftA.id));
    const reach = reachableFrom(tRep, nodeConns); // fresh: includes bridges just added
    for (const liftB of usedLifts) {
      if (liftA.id === liftB.id) continue;
      const bRep = uf.find(liftBaseId(liftB.id));
      if (reach.has(bRep)) continue;
      const d = haversine(liftA.top_station, liftB.base_station);
      if (d > AUTO_BRIDGE_RADIUS_M) continue;
      if (liftA.elev_top != null && liftB.elev_base != null
          && liftB.elev_base - liftA.elev_top > AUTO_BRIDGE_MAX_CLIMB_M) continue;
      const name = `Traverse to ${liftB.name ?? liftB.id}`;
      if (!addEdge(tRep, bRep, name, 'slope', 'green')) continue; // false = already added
      bridgesAdded++; changed = true;
    }
  }
}
console.log(`  → Auto-bridged ${bridgesAdded} lift-to-lift gaps (${passes} pass${passes!==1?'es':''})`);

// ── Assemble final node list ──────────────────────────────────────────────────

const nodes = [];
const addedNodes = new Set();

// Some lift names collide across different resorts (e.g. two unrelated lifts
// both called "Lac"). Disambiguate by appending the resort name wherever a
// bare name is shared by lifts at more than one resort — otherwise the search
// UI shows identical entries and picking the wrong one silently lands in an
// unrelated, disconnected part of the graph.
const resortsByName = new Map(); // bare lift name → Set(resort_nearest)
for (const lift of usedLifts) {
  if (!resortsByName.has(lift.name)) resortsByName.set(lift.name, new Set());
  resortsByName.get(lift.name).add(lift.resort_nearest);
}

// Helper to build meta for a cluster representative node
function makeLiftNode(repId) {
  const isBase = repId.endsWith('_base');
  const liftId = parseInt(repId.split('_')[1]);
  const lift   = liftsById.get(liftId);
  const bareName = lift?.name ?? `Lift ${liftId}`;
  const ambiguous = (resortsByName.get(bareName)?.size ?? 0) > 1;
  const name = ambiguous && lift?.resort_nearest ? `${bareName} (${lift.resort_nearest})` : bareName;
  const pt = liftPts.get(repId);
  return {
    id:           repId,
    name:         `${name} (${isBase ? 'base' : 'summit'})`,
    country:      mapCountry(lift?.resort_nearest ?? ''),
    station_type: isBase ? 'lift-base' : 'lift-top',
    lift_type:    mapLiftType(lift?.lift_type),
    lat:          pt?.lat ?? null,
    lon:          pt?.lon ?? null,
    // Station altitude in metres, from the Copernicus DEM (enrich-osm-source.js),
    // not a surveyed station height — the official map publishes none. Can be
    // off by ~10 m, enough that a few near-flat beginner lifts read as "downhill".
    elevation:    (isBase ? lift?.elev_base : lift?.elev_top) ?? null,
    connections:  nodeConns.get(repId) ?? [],
  };
}

/** Centroid of every piste endpoint merged into a junction cluster — its OSM-derived location. */
function junctionCentroid(repId) {
  let sumLat = 0, sumLon = 0, n = 0, sumElev = 0, nElev = 0;
  for (const [ptId, pt] of pistePts) {
    if (uf.find(ptId) !== repId) continue;
    sumLat += pt.lat;
    sumLon += pt.lon;
    n++;
    if (pt.elev != null) { sumElev += pt.elev; nElev++; }
  }
  return n > 0
    ? { lat: sumLat / n, lon: sumLon / n, elevation: nElev > 0 ? Math.round(sumElev / nElev) : null }
    : null;
}

// Collect representative IDs for piste junction clusters
// Key: junction nodes should not appear in the search UI → station_type: 'junction'
// Determine country by finding any piste in the cluster
const junctionResort = new Map(); // rep → resort name (for country)
for (const [ptId, pt] of pistePts) {
  const rep = uf.find(ptId);
  if (!rep.startsWith('piste_')) continue; // it's a lift-station rep, handled below
  if (!junctionResort.has(rep)) {
    const pisteId = parseInt(ptId.split('_')[1]);
    const piste = pistesById.get(pisteId);
    junctionResort.set(rep, piste?.resort_nearest ?? 'Avoriaz');
  }
}

// Add lift nodes first (for all used lifts)
for (const lift of usedLifts) {
  for (const id of [liftBaseId(lift.id), liftTopId(lift.id)]) {
    const rep = uf.find(id);
    if (addedNodes.has(rep)) continue;
    addedNodes.add(rep);
    nodes.push(makeLiftNode(rep));
  }
}

// Village nodes (defined here so both the junction-exclusion check below and the
// village-node assembly further down share one list — a node missing from this
// list falls through into the junction loop and gets wrongly split into two
// nodes: a hidden 'junction' twin that steals all its inbound edges, and the
// visible 'village' node left with none. That happened to chatel-village.)
// Coordinates come from the matching entry in data/resorts.json (hand-maintained,
// real resort centroids) rather than new hand-typed values — see resortSlug below.
const VILLAGE_NODES = [
  ['morzine-village',    'Morzine',               'FR', 'morzine'],
  ['champery',           'Champéry',               'CH', 'champery'],
  ['saint-jean-daulps',  "Saint-Jean-d'Aulps",    'FR', 'st-jean-aulps'],
  ['chatel-village',     'Châtel',                'FR', 'chatel'],
  ['morgins-village',    'Morgins',               'CH', 'morgins'],
  ['les-gets-village',   'Les Gets',              'FR', 'les-gets'],
];
const villageIds = new Set(VILLAGE_NODES.map(([vid]) => vid));

// Add junction nodes (piste-endpoint cluster reps not already added as lift nodes)
let jctSeq = 0;
const repToJunctionId = new Map();

for (const [repId] of nodeConns) {
  if (addedNodes.has(repId)) continue;
  if (villageIds.has(repId)) continue; // handled below

  addedNodes.add(repId);
  const jctId = `jct_${String(++jctSeq).padStart(4, '0')}`;
  repToJunctionId.set(repId, jctId);

  const resort  = junctionResort.get(repId) ?? 'Avoriaz';
  // Find a name: if any named piste endpoint is in this cluster, use that piste name
  let jctName = 'Junction';
  for (const [ptId, pt] of pistePts) {
    if (uf.find(ptId) !== repId) continue;
    const piste = pistesById.get(pt.pisteId);
    if (piste?.name) { jctName = piste.name; break; }
  }

  const centroid = junctionCentroid(repId);

  nodes.push({
    id:           jctId,
    name:         jctName,
    country:      mapCountry(resort),
    station_type: 'junction',
    lift_type:    null,
    lat:          centroid?.lat ?? null,
    lon:          centroid?.lon ?? null,
    // Mean DEM altitude of the piste ends merged here (split points interpolated).
    elevation:    centroid?.elevation ?? null,
    connections:  nodeConns.get(repId) ?? [],
  });
}

// Replace internal piste cluster rep IDs with the clean jct_XXXX IDs in all connection targets
for (const node of nodes) {
  for (const conn of node.connections) {
    if (repToJunctionId.has(conn.to)) conn.to = repToJunctionId.get(conn.to);
  }
}

// Village nodes
for (const [vid, vname, vcountry, resortSlug] of VILLAGE_NODES) {
  const resort = resortBySlug.get(resortSlug);
  nodes.push({
    id:           vid,
    name:         vname,
    country:      vcountry,
    station_type: 'village',
    lift_type:    null,
    lat:          resort?.lat ?? null,
    lon:          resort?.lon ?? null,
    elevation:    resort?.elevation ?? null, // resorts.json village altitude
    connections:  nodeConns.get(vid) ?? [],
  });
}

// ── Validate referential integrity ───────────────────────────────────────────

const nodeIds = new Set(nodes.map(n => n.id));
const broken  = [];
for (const n of nodes) {
  for (const c of n.connections) {
    if (!nodeIds.has(c.to)) broken.push(`${n.id} → ${c.to} ("${c.name}")`);
  }
}
if (broken.length) {
  console.error(`${broken.length} broken edges:`);
  broken.slice(0, 20).forEach(b => console.error('  ', b));
  process.exit(1);
}

// ── Write output ──────────────────────────────────────────────────────────────

const totalEdges = nodes.reduce((s, n) => s + n.connections.length, 0);
const liftCount  = nodes.filter(n => n.station_type === 'lift-base').length;
const jctCount   = nodes.filter(n => n.station_type === 'junction').length;

const network = {
  _meta: {
    season:         '2024/25',
    scope:          `Portes du Soleil — OSM-derived network with slope junction nodes and per-node ` +
                    `coordinates. ${liftCount} lifts, ${jctCount} slope junctions, ${totalEdges} directed edges. Schema v3.`,
    schema_version: '3',
  },
  nodes,
};

writeFileSync(OUT, JSON.stringify(network, null, 2));
console.log(`✓ Wrote ${nodes.length} nodes (${liftCount} lifts + ${jctCount} junctions) | ${totalEdges} edges → ${relative(process.cwd(), OUT)}`);
