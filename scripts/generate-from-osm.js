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
const SRC = join(__dirname, '../data/portes_du_soleil_graph.json');
const OUT = join(__dirname, '../data/network.json');

const { lifts, pistes, edges: osmEdges } = JSON.parse(readFileSync(SRC, 'utf8'));

// ── Config ────────────────────────────────────────────────────────────────────

const PISTE_CLUSTER_RADIUS_M = 75;   // piste endpoints within this distance share a junction
const AUTO_BRIDGE_RADIUS_M   = 400;  // lift-top → lift-base gap filler (smaller than before
                                     // because junctions handle most within-resort connectivity)

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

// ── Saint-Jean-d'Aulps lifts ───────────────────────────────────────────────────
// SJA / Grande Terche ski domain was absent from the OSM source data bounding box.
// Lift coordinates fetched manually from OSM way API (api.openstreetmap.org).
// Note: SJA connects to the main Portes du Soleil circuit by shuttle bus only —
// there is no ski-in/ski-out link. It is modelled as an independent sub-domain.
const SJA_LIFTS = [
  // Grande Terche gondola: OSM way is recorded TOP→BASE; we swap to BASE→TOP here
  { id: 23275859,  name: 'Grande Terche',  lift_type: 'gondola',
    base_station: { lat: 46.2148862, lon: 6.6318332 },
    top_station:  { lat: 46.2260879, lon: 6.6413460 }, resort_nearest: "Saint-Jean-d'Aulps" },
  { id: 288892180, name: 'Chargeau',       lift_type: 'chair_lift',
    base_station: { lat: 46.2037647, lon: 6.6244991 },
    top_station:  { lat: 46.2068564, lon: 6.6296275 }, resort_nearest: "Saint-Jean-d'Aulps" },
  { id: 288893232, name: 'Graydon',        lift_type: 'chair_lift',
    base_station: { lat: 46.2034036, lon: 6.6239976 },
    top_station:  { lat: 46.1988470, lon: 6.6125981 }, resort_nearest: "Saint-Jean-d'Aulps" },
  { id: 297428605, name: 'Bray',           lift_type: 'platter',
    base_station: { lat: 46.2141840, lon: 6.6321726 },
    top_station:  { lat: 46.2116980, lon: 6.6315109 }, resort_nearest: "Saint-Jean-d'Aulps" },
  { id: 297428606, name: 'Esserailloux',   lift_type: 'platter',
    base_station: { lat: 46.2183759, lon: 6.6405357 },
    top_station:  { lat: 46.2123912, lon: 6.6327457 }, resort_nearest: "Saint-Jean-d'Aulps" },
  { id: 317020631, name: 'Terchette',      lift_type: 'platter',
    base_station: { lat: 46.2142762, lon: 6.6313429 },
    top_station:  { lat: 46.2126431, lon: 6.6303774 }, resort_nearest: "Saint-Jean-d'Aulps" },
  { id: 378209423, name: 'Têtes',          lift_type: 'chair_lift',
    base_station: { lat: 46.2140004, lon: 6.6330406 },
    top_station:  { lat: 46.2070802, lon: 6.6290738 }, resort_nearest: "Saint-Jean-d'Aulps" },
  { id: 776556045, name: 'Lac',            lift_type: 'platter',
    base_station: { lat: 46.2149274, lon: 6.6220646 },
    top_station:  { lat: 46.2176749, lon: 6.6282352 }, resort_nearest: "Saint-Jean-d'Aulps" },
  { id: 904857550, name: 'Lanches',        lift_type: 'platter',
    base_station: { lat: 46.2110545, lon: 6.6283588 },
    top_station:  { lat: 46.2124062, lon: 6.6310332 }, resort_nearest: "Saint-Jean-d'Aulps" },
];

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
  constructor() { this.p = new Map(); this.rank = new Map(); }
  add(id)       { if (!this.p.has(id)) { this.p.set(id, id); this.rank.set(id, 0); } }
  find(id) {
    if (this.p.get(id) !== id) this.p.set(id, this.find(this.p.get(id)));
    return this.p.get(id);
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    const aIsLift = ra.startsWith('lift_'), bIsLift = rb.startsWith('lift_');
    // Never merge two different lift station clusters — each lift node stays distinct
    if (aIsLift && bIsLift) return;
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

const usedLifts  = lifts.filter(l => !EXCLUDED_RESORTS.has(l.resort_nearest));
const usedLiftIds = new Set(usedLifts.map(l => l.id));
const liftsById  = new Map(lifts.map(l => [l.id, l]));
// Merge manual SJA lifts into liftsById so makeLiftNode can resolve their metadata
for (const lift of SJA_LIFTS) liftsById.set(lift.id, lift);
const allUsedLifts = [...usedLifts, ...SJA_LIFTS];
const pistesById = new Map(pistes.map(p => [p.id, p]));

// Spatial data for all points
const liftPts  = new Map(); // nodeId → {lat,lon}
const pistePts = new Map(); // nodeId → {lat,lon,pisteId}

for (const lift of allUsedLifts) {
  liftPts.set(liftBaseId(lift.id), { lat: lift.base_station.lat, lon: lift.base_station.lon });
  liftPts.set(liftTopId(lift.id),  { lat: lift.top_station.lat,  lon: lift.top_station.lon  });
}

for (const piste of pistes) {
  if (!piste.start?.lat || !piste.end?.lat) continue;
  pistePts.set(`piste_${piste.id}_start`, { lat: piste.start.lat, lon: piste.start.lon, pisteId: piste.id });
  pistePts.set(`piste_${piste.id}_end`,   { lat: piste.end.lat,   lon: piste.end.lon,   pisteId: piste.id });
}

// ── Build Union-Find ──────────────────────────────────────────────────────────

const uf = new UF();
for (const id of liftPts.keys())  uf.add(id);
for (const id of pistePts.keys()) uf.add(id);

// Step 1: merge lift stations with nearby piste endpoints (from OSM proximity edges)
for (const e of osmEdges) {
  if (!usedLiftIds.has(e.lift_id)) continue;
  const liftId = e.lift_station === 'top' ? liftTopId(e.lift_id) : liftBaseId(e.lift_id);
  const pistId = e.piste_end   === 'start' ? `piste_${e.piste_id}_start` : `piste_${e.piste_id}_end`;
  if (pistePts.has(pistId)) uf.union(liftId, pistId);
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

for (const lift of allUsedLifts) {
  const baseRep = uf.find(liftBaseId(lift.id));
  const topRep  = uf.find(liftTopId(lift.id));
  if (baseRep === topRep) continue; // shouldn't happen but guard it
  addEdge(baseRep, topRep, lift.name ?? `Lift ${lift.id}`, 'lift', 'green');
}

// ── Piste (slope) edges ───────────────────────────────────────────────────────

for (const piste of pistes) {
  if (!piste.start?.lat || !piste.end?.lat) continue;

  const startKey = `piste_${piste.id}_start`;
  const endKey   = `piste_${piste.id}_end`;

  let fromRep = uf.find(startKey);
  let toRep   = uf.find(endKey);
  if (fromRep === toRep) continue; // piste too short / collapsed into one cluster

  // Apply direction correction for known-reversed piste ways
  if (pisteDir.get(piste.id) === 'reversed') [fromRep, toRep] = [toRep, fromRep];

  const difficulty = mapDiff(piste.difficulty);
  const name       = piste.name ?? `Slope (${difficulty})`;
  addEdge(fromRep, toRep, name, 'slope', difficulty);
}

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

// ── Saint-Jean-d'Aulps internal routing edges ─────────────────────────────────
// SJA has no OSM piste data to drive junction clustering, so inter-lift routes
// are specified manually based on the known ski area topology.
const SJA_SECTOR = [
  // Village ↔ gondola base
  { from: 'saint-jean-daulps', to: liftBaseId(23275859),
    name: "Access Grande Terche gondola", type: 'slope', difficulty: 'green' },
  { from: liftBaseId(23275859), to: 'saint-jean-daulps',
    name: "Return to Saint-Jean-d'Aulps", type: 'slope', difficulty: 'green' },

  // Gondola top → mid-mountain lift bases (plateau ~1500m)
  { from: liftTopId(23275859), to: liftBaseId(378209423),
    name: 'Traverse to Têtes',       type: 'slope', difficulty: 'green' },
  { from: liftTopId(23275859), to: liftBaseId(297428605),
    name: 'Traverse to Bray',        type: 'slope', difficulty: 'green' },
  { from: liftTopId(23275859), to: liftBaseId(317020631),
    name: 'Traverse to Terchette',   type: 'slope', difficulty: 'green' },
  { from: liftTopId(23275859), to: liftBaseId(904857550),
    name: 'Traverse to Lanches',     type: 'slope', difficulty: 'green' },
  { from: liftTopId(23275859), to: liftBaseId(297428606),
    name: 'Traverse to Esserailloux', type: 'slope', difficulty: 'blue' },
  { from: liftTopId(23275859), to: liftBaseId(776556045),
    name: 'Access Lac area',         type: 'slope', difficulty: 'green' },

  // Gondola top → main descent back to valley
  { from: liftTopId(23275859), to: liftBaseId(23275859),
    name: 'La Grande Terche',        type: 'slope', difficulty: 'blue' },

  // Têtes summit → upper Chargeau / Graydon sector
  { from: liftTopId(378209423), to: liftBaseId(288892180),
    name: 'Descent to Chargeau',     type: 'slope', difficulty: 'blue' },
  { from: liftTopId(378209423), to: liftBaseId(288893232),
    name: 'Descent to Graydon',      type: 'slope', difficulty: 'red'  },

  // Cross-lift traverses at upper sector (~1530m)
  { from: liftTopId(288892180), to: liftBaseId(288893232),
    name: 'Chargeau to Graydon',     type: 'slope', difficulty: 'blue' },
  { from: liftTopId(288893232), to: liftBaseId(288892180),
    name: 'Graydon to Chargeau',     type: 'slope', difficulty: 'red'  },

  // Upper sector → back to mid-plateau (return to gondola area)
  { from: liftBaseId(288892180), to: liftBaseId(378209423),
    name: 'Traverse to Têtes base',  type: 'slope', difficulty: 'green' },
  { from: liftBaseId(288893232), to: liftBaseId(378209423),
    name: 'Traverse to Têtes base',  type: 'slope', difficulty: 'green' },

  // Small lift tops → back to gondola top plateau
  { from: liftTopId(297428605), to: liftTopId(23275859),
    name: 'La Bray descent',         type: 'slope', difficulty: 'green' },
  { from: liftTopId(317020631), to: liftTopId(23275859),
    name: 'Terchette descent',       type: 'slope', difficulty: 'green' },
  { from: liftTopId(904857550), to: liftTopId(23275859),
    name: 'Les Lanches descent',     type: 'slope', difficulty: 'green' },
  { from: liftTopId(297428606), to: liftTopId(23275859),
    name: 'Esserailloux descent',    type: 'slope', difficulty: 'blue'  },
  { from: liftTopId(776556045), to: liftTopId(23275859),
    name: 'Lac descent',             type: 'slope', difficulty: 'green' },
];

// Village node initialisation (ensure keys exist before manual edges are applied)
ensureNode('morzine-village');
ensureNode('champery');
ensureNode('saint-jean-daulps');

for (const e of [...CROSS_SECTOR, ...SJA_SECTOR]) {
  // Village nodes are not in UF — use their ID directly
  const fromRep = uf.find(e.from) ?? e.from;
  const toRep   = uf.find(e.to)   ?? e.to;
  const from = (fromRep === undefined || fromRep === e.from) ? e.from : fromRep;
  const to   = (toRep   === undefined || toRep   === e.to)   ? e.to   : toRep;
  addEdge(from, to, e.name, e.type, e.difficulty);
}

// ── Auto-bridge lift-to-lift gaps ─────────────────────────────────────────────
// Piste junctions now handle most within-resort connectivity, but a few lift
// tops may still be disconnected from nearby lift bases. Bridge gaps ≤ threshold.

function buildCompOf(conns) {
  const compOf = new Map();
  let cId = 0;
  for (const start of conns.keys()) {
    if (compOf.has(start)) continue;
    const vis = new Set([start]), q = [start];
    while (q.length) {
      const curr = q.shift();
      for (const e of conns.get(curr) ?? []) {
        if (!vis.has(e.to) && conns.has(e.to)) { vis.add(e.to); q.push(e.to); }
      }
    }
    for (const id of vis) compOf.set(id, cId);
    cId++;
  }
  return compOf;
}

let bridgesAdded = 0, passes = 0, changed = true;
while (changed && passes < 10) {
  changed = false; passes++;
  const compOf = buildCompOf(nodeConns);
  for (const liftA of allUsedLifts) {
    const tId = liftTopId(liftA.id);
    const tRep = uf.find(tId);
    const cA   = compOf.get(tRep);
    for (const liftB of allUsedLifts) {
      if (liftA.id === liftB.id) continue;
      const bId  = liftBaseId(liftB.id);
      const bRep = uf.find(bId);
      if (compOf.get(bRep) === cA) continue;
      const d = haversine(liftA.top_station, liftB.base_station);
      if (d > AUTO_BRIDGE_RADIUS_M) continue;
      const name = `Traverse to ${liftB.name ?? liftB.id}`;
      if (!addEdge(tRep, bRep, name, 'slope', 'green')) continue; // addEdge returns undefined when it deduplicates
      // Force call: addEdge checks seenEdges internally; if new, it adds it
      bridgesAdded++; changed = true;
    }
  }
}
console.log(`  → Auto-bridged ${bridgesAdded} lift-to-lift gaps (${passes} pass${passes!==1?'es':''})`);

// ── Assemble final node list ──────────────────────────────────────────────────

const nodes = [];
const addedNodes = new Set();

// Helper to build meta for a cluster representative node
function makeLiftNode(repId) {
  const isBase = repId.endsWith('_base');
  const liftId = parseInt(repId.split('_')[1]);
  const lift   = liftsById.get(liftId);
  const name   = lift?.name ?? `Lift ${liftId}`;
  return {
    id:           repId,
    name:         `${name} (${isBase ? 'base' : 'summit'})`,
    country:      mapCountry(lift?.resort_nearest ?? ''),
    station_type: isBase ? 'lift-base' : 'lift-top',
    lift_type:    mapLiftType(lift?.lift_type),
    connections:  nodeConns.get(repId) ?? [],
  };
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

// Add lift nodes first (for all used lifts including SJA manual lifts)
for (const lift of allUsedLifts) {
  for (const id of [liftBaseId(lift.id), liftTopId(lift.id)]) {
    const rep = uf.find(id);
    if (addedNodes.has(rep)) continue;
    addedNodes.add(rep);
    nodes.push(makeLiftNode(rep));
  }
}

// Add junction nodes (piste-endpoint cluster reps not already added as lift nodes)
let jctSeq = 0;
const repToJunctionId = new Map();

for (const [repId] of nodeConns) {
  if (addedNodes.has(repId)) continue;
  if (repId === 'morzine-village' || repId === 'champery') continue; // handled below

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

  nodes.push({
    id:           jctId,
    name:         jctName,
    country:      mapCountry(resort),
    station_type: 'junction',
    lift_type:    null,
    connections:  nodeConns.get(repId) ?? [],
  });
}

// Replace internal piste cluster rep IDs with the clean jct_XXXX IDs in all connection targets
for (const node of nodes) {
  for (const conn of node.connections) {
    if (repToJunctionId.has(conn.to)) conn.to = repToJunctionId.get(conn.to);
  }
}
// Also update node.id for junctions (already set above, but verify connections point there)
// And fix "from" side — node.id was set to jctId above, so the keys in nodeConns still point
// to the old repId. The connections' `to` values now use jctId from the loop above.

// Village nodes
for (const [vid, vname, vcountry] of [
  ['morzine-village',    'Morzine',               'FR'],
  ['champery',           'Champéry',               'CH'],
  ['saint-jean-daulps',  "Saint-Jean-d'Aulps",    'FR'],
]) {
  nodes.push({
    id:           vid,
    name:         vname,
    country:      vcountry,
    station_type: 'village',
    lift_type:    null,
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
    scope:          `Portes du Soleil — OSM-derived network with slope junction nodes. ` +
                    `${liftCount} lifts, ${jctCount} slope junctions, ${totalEdges} directed edges. Schema v2.`,
    schema_version: '2',
  },
  nodes,
};

writeFileSync(OUT, JSON.stringify(network, null, 2));
console.log(`✓ Wrote ${nodes.length} nodes (${liftCount} lifts + ${jctCount} junctions) | ${totalEdges} edges → ${relative(process.cwd(), OUT)}`);
