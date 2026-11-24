#!/usr/bin/env node
/**
 * Adds the two things data/portes_du_soleil_graph.json was missing for
 * reliable routing, both measured rather than guessed:
 *
 *  - `geometry` on every piste: its full OSM polyline ([[lat, lon], …]), not
 *    just its two endpoints. OSM pistes very often end *on* another piste,
 *    part-way along it, or run past a lift station mid-way; with endpoints
 *    alone the generator can't see either junction, which left most of the
 *    network one-way (you could ski into a sector but not back out).
 *  - elevations (`elev_start`/`elev_end` on pistes, `elev_base`/`elev_top` on
 *    lifts) from the Open-Meteo elevation API (Copernicus DEM, no key), so the
 *    generator can orient every piste downhill instead of inferring direction
 *    from which lift station happens to be nearest.
 *
 * Idempotent and resumable: only fills fields that are missing, and saves
 * after each elevation batch (both public APIs rate-limit). Re-run until it
 * reports nothing left to fetch, then run generate-from-osm.js.
 *
 * Usage: node scripts/enrich-osm-source.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../data/portes_du_soleil_graph.json');

// The main instance is often at capacity; its own error page recommends
// backing off and retrying, and the mirrors serve the same data.
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
// Split in two: one query over the whole area is heavy enough to be refused.
const BBOXES = ['46.10,6.55,46.36,6.77', '46.10,6.77,46.36,6.99'];
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';
const ELEVATION_BATCH = 100; // the API's per-request coordinate limit
const HEADERS = { 'User-Agent': 'chemins-du-soleil-data/1.0' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const round = v => Math.round(v * 1e6) / 1e6;

async function withRetry(label, fn, attempts = 6) {
  let wait = 15_000;
  for (let i = 1; ; i++) {
    try { return await fn(i); } catch (err) {
      if (i >= attempts) throw new Error(`${label}: ${err.message}`);
      console.log(`  ${label} failed (${err.message}); retrying in ${wait / 1000}s`);
      await sleep(wait);
      wait *= 2;
    }
  }
}

async function overpass(query) {
  return withRetry('Overpass', async attempt => {
    const url = OVERPASS_URLS[(attempt - 1) % OVERPASS_URLS.length];
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
    return (await res.json()).elements;
  });
}

async function elevations(points) {
  return withRetry('Open-Meteo elevation', async () => {
    const url = `${ELEVATION_URL}?latitude=${points.map(p => p.lat).join(',')}&longitude=${points.map(p => p.lon).join(',')}`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`${res.status}`);
    const { elevation } = await res.json();
    if (elevation?.length !== points.length) throw new Error('short response');
    return elevation;
  });
}

const src = JSON.parse(readFileSync(SRC, 'utf8'));
const save = () => writeFileSync(SRC, JSON.stringify(src, null, 2));

// ── Piste geometry ───────────────────────────────────────────────────────────
const needGeometry = src.pistes.filter(p => !p.geometry);
if (needGeometry.length) {
  const byId = new Map();
  for (const bbox of BBOXES) {
    const els = await overpass(`[out:json][timeout:180];way["piste:type"](${bbox});out tags geom;`);
    for (const el of els) if (el.geometry) byId.set(el.id, el.geometry);
  }
  let filled = 0;
  for (const p of needGeometry) {
    const g = byId.get(p.osm_way_id);
    if (!g) continue; // deleted from OSM since the extract; keeps its two endpoints
    p.geometry = g.map(pt => [round(pt.lat), round(pt.lon)]);
    filled++;
  }
  save();
  console.log(`✓ Geometry for ${filled}/${needGeometry.length} pistes (${needGeometry.length - filled} no longer in OSM)`);
}

// ── Elevations ───────────────────────────────────────────────────────────────
const todo = [];
for (const p of src.pistes) {
  if (p.start?.lat && p.elev_start == null) todo.push({ obj: p, key: 'elev_start', pt: p.start });
  if (p.end?.lat && p.elev_end == null)     todo.push({ obj: p, key: 'elev_end', pt: p.end });
}
for (const l of src.lifts) {
  if (l.elev_base == null) todo.push({ obj: l, key: 'elev_base', pt: l.base_station });
  if (l.elev_top == null)  todo.push({ obj: l, key: 'elev_top', pt: l.top_station });
}
for (let i = 0; i < todo.length; i += ELEVATION_BATCH) {
  const batch = todo.slice(i, i + ELEVATION_BATCH);
  const els = await elevations(batch.map(t => ({ lat: round(t.pt.lat), lon: round(t.pt.lon) })));
  batch.forEach((t, j) => { t.obj[t.key] = els[j]; });
  save();
  await sleep(1500);
}
console.log(`✓ Elevations for ${todo.length} points${todo.length ? '' : ' (nothing left to fetch)'}`);
