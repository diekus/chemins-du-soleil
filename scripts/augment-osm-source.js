#!/usr/bin/env node
/**
 * Adds lifts (and the pistes around them) that are missing from
 * data/portes_du_soleil_graph.json, fetched from the live OSM Overpass API.
 *
 * The original extract (overpass.osm.ch) missed most of Les Gets, half of
 * Morzine (Pléney, Super-Morzine) and all of Abondance. Rather than replace
 * the source — which every manual bridge in generate-from-osm.js is keyed
 * against — this only *appends*: existing lifts, pistes and proximity edges
 * are left untouched, so re-running is a no-op once everything is in.
 *
 * Lifts are added only from ADD_LIFTS: OSM way ids each confirmed against an
 * independent lift register (see the comments there), never a blanket
 * bounding-box sweep, which would pull in neighbouring non-Portes du Soleil
 * areas (Praz de Lys–Sommand, Bernex, Hirmentaz). Pistes are added if they
 * chain, endpoint to endpoint within MATCH_RADIUS_M, to the existing network
 * or to one of those lifts — so they come along with the lifts that serve
 * them, and nothing from an unconnected neighbouring area does.
 *
 * Usage: node scripts/augment-osm-source.js   then   node scripts/generate-from-osm.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC         = join(__dirname, '../data/portes_du_soleil_graph.json');
const RESORTS_SRC = join(__dirname, '../data/resorts.json');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BBOX = '46.10,6.55,46.36,6.99';
const MATCH_RADIUS_M = 100; // same as the original extract's lift–piste radius

// Confirmed against skiresort.info's Portes du Soleil lift register (163 lifts)
// and, for Abondance (not in that register), remontees-mecaniques.net's
// Abondance station page (in-service lifts only; TKD de la Pêche, out of
// service since 2007, is deliberately absent).
const ADD_LIFTS = {
  // Les Gets
  30626904: 'Charniaz Express', 30749534: 'Rosta', 30960128: 'Ranfoilly Express',
  30961292: 'Folliets du Golf', 32310310: 'Têtes', 32344719: 'Nauchets Express',
  49511429: 'Chavannes', 49511430: 'Chavannes Express', 49511432: 'Chéry Nord',
  49511436: 'Mont Chéry', 49511437: 'Stade', 49511439: 'La Pointe', 49532861: 'Croix',
  53180783: 'Planeys', 53183221: 'Perrières Express', 53183269: 'Turche',
  147476688: 'Vieux Chêne', 147533117: 'Boule de Gomme', 147533118: 'Mouille au Roy',
  203618751: 'Tête des Crêts', 286275367: 'Nabor', 317023891: 'Grand Cry',
  771016803: 'Troncs Express', 1226916177: 'Telecorde Mouille au Blé', 1450703362: 'Ébauds',
  // Morzine (Pléney and Super-Morzine sectors)
  30626081: 'Belvédère', 30627383: 'Crusaz', 30751809: 'Mouilles', 30752181: 'Pléney',
  32310365: 'Fys', 53165460: 'Super-Morzine', 96360500: 'Atray',
  295651443: 'Bouchet', 295651444: 'Mas Verjus',
  // Abondance
  55037927: 'Essert', 317447558: 'Corne 1', 55038474: 'Corne 2', 151490329: 'Petit Covagny',
  151490330: 'Grand Frémoux', 151490331: 'Petit Frémoux', 151490332: 'Lac', 889626179: 'Follys',
};

// Source-file resort names (resort_nearest), keyed by data/resorts.json slug.
// Val-d'Illiez has no entry of its own in the source; it was always folded into Champéry.
const SOURCE_RESORT_NAME = {
  'avoriaz': 'Avoriaz', 'morzine': 'Morzine', 'les-gets': 'Les Gets', 'chatel': 'Chatel',
  'chapelle-abondance': "La Chapelle-d'Abondance", 'abondance': 'Abondance',
  'st-jean-aulps': "Saint-Jean-d'Aulps", 'torgon': 'Torgon', 'morgins': 'Morgins',
  'champoussin': 'Champoussin', 'les-crosets': 'Les Crosets', 'val-dilliez': 'Champery',
  'champery': 'Champery',
};

function haversine(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function overpass(query) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'User-Agent': 'chemins-du-soleil-data/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  return (await res.json()).elements;
}

const src = JSON.parse(readFileSync(SRC, 'utf8'));
const { resorts } = JSON.parse(readFileSync(RESORTS_SRC, 'utf8'));

function resortNearest(pt) {
  let best = null, bestD = Infinity;
  for (const r of resorts) {
    const d = haversine(pt, r);
    if (d < bestD) { best = r; bestD = d; }
  }
  return SOURCE_RESORT_NAME[best.slug];
}

const elements = await overpass(
  `[out:json][timeout:120];(way(id:${Object.keys(ADD_LIFTS).join(',')});` +
  `way["piste:type"~"^(downhill|connection)$"](${BBOX}););out tags geom;`,
);

const ends = el => ({ start: el.geometry[0], end: el.geometry[el.geometry.length - 1] });
const pt = p => ({ lat: p.lat, lon: p.lon });

// ── Lifts ────────────────────────────────────────────────────────────────────
const haveLift = new Set(src.lifts.map(l => l.osm_way_id));
const newLifts = [];
for (const el of elements) {
  if (!(el.id in ADD_LIFTS) || haveLift.has(el.id) || !el.tags.aerialway) continue;
  const { start, end } = ends(el);
  newLifts.push({
    id: el.id,
    name: el.tags.name ?? null,
    lift_type: el.tags.aerialway,
    capacity_per_hour: el.tags['aerialway:capacity'] ?? null,
    occupancy: el.tags['aerialway:occupancy'] ?? null,
    duration: el.tags['aerialway:duration'] ?? null,
    length_m: null,
    vertical_difference_m: null,
    detachable: el.tags['aerialway:detachable'] ?? null,
    bubble: el.tags['aerialway:bubble'] ?? null,
    year_built: el.tags.start_date ?? null,
    ref: el.tags.ref ?? null,
    // OSM aerialways are drawn bottom → top.
    base_station: pt(start),
    top_station: pt(end),
    resort_nearest: resortNearest(start),
    osm_way_id: el.id,
  });
}
const missing = Object.keys(ADD_LIFTS).map(Number)
  .filter(id => !haveLift.has(id) && !newLifts.some(l => l.id === id));
if (missing.length) throw new Error(`Allow-listed lifts not found in OSM: ${missing.join(', ')}`);

// ── Pistes: flood outward from the existing network and the new lifts ───────
const allLifts = [...src.lifts, ...newLifts];
const anchors = [
  ...allLifts.flatMap(l => [l.base_station, l.top_station]),
  ...src.pistes.flatMap(p => [p.start, p.end]).filter(p => p?.lat),
];
const havePiste = new Set(src.pistes.map(p => p.osm_way_id));
const isClosed = t => t['piste:abandoned'] === 'yes' || /abandoned|disused/.test(t['piste:status'] ?? '');
let candidates = elements.filter(el =>
  el.tags['piste:type'] && !havePiste.has(el.id) && !isClosed(el.tags) && el.geometry?.length >= 2);

const newPistes = [];
let grew = true;
while (grew) {
  grew = false;
  const remaining = [];
  for (const el of candidates) {
    const { start, end } = ends(el);
    if (anchors.some(a => haversine(a, start) <= MATCH_RADIUS_M || haversine(a, end) <= MATCH_RADIUS_M)) {
      newPistes.push({
        id: el.id,
        name: el.tags.name ?? null,
        ref: el.tags['piste:ref'] ?? el.tags.ref ?? null,
        piste_type: el.tags['piste:type'],
        difficulty: el.tags['piste:difficulty'] ?? null,
        grooming: el.tags['piste:grooming'] ?? null,
        lit: el.tags['piste:lit'] ?? null,
        status: el.tags['piste:status'] ?? null,
        start: pt(start),
        end: pt(end),
        resort_nearest: resortNearest(start),
        osm_way_id: el.id,
      });
      anchors.push(start, end);
      grew = true;
    } else {
      remaining.push(el);
    }
  }
  candidates = remaining;
}

// ── Lift ↔ piste proximity edges involving anything new ─────────────────────
const newLiftIds  = new Set(newLifts.map(l => l.id));
const newPisteIds = new Set(newPistes.map(p => p.id));
const allPistes   = [...src.pistes, ...newPistes];
const newEdges = [];
for (const lift of allLifts) {
  for (const piste of allPistes) {
    if (!newLiftIds.has(lift.id) && !newPisteIds.has(piste.id)) continue;
    if (!piste.start?.lat || !piste.end?.lat) continue;
    for (const station of ['base', 'top']) {
      for (const pisteEnd of ['start', 'end']) {
        const d = haversine(lift[`${station}_station`], piste[pisteEnd]);
        if (d <= MATCH_RADIUS_M) {
          newEdges.push({ lift_id: lift.id, piste_id: piste.id, lift_station: station, piste_end: pisteEnd, distance_m: Math.round(d * 10) / 10 });
        }
      }
    }
  }
}

// Appended after the existing records so the generator processes the original
// data first and its existing clustering decisions are unchanged.
src.lifts.push(...newLifts);
src.pistes.push(...newPistes);
src.edges.push(...newEdges);

const summary = {};
for (const r of newLifts.map(l => l.resort_nearest)) summary[r] = (summary[r] ?? 0) + 1;
src.metadata.lift_count  = src.lifts.length;
src.metadata.piste_count = src.pistes.length;
src.metadata.edge_count  = src.edges.length;
src.metadata.augmented = `Lifts/pistes missing from the original overpass.osm.ch extract added from ${OVERPASS_URL} by scripts/augment-osm-source.js.`;

writeFileSync(SRC, JSON.stringify(src, null, 2));
console.log(`✓ Added ${newLifts.length} lifts ${JSON.stringify(summary)}, ${newPistes.length} pistes, ${newEdges.length} proximity edges`);
