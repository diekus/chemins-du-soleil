# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Serve the app (required — fetch() won't work on file://)
npx serve .
# or: python3 -m http.server 8000

# Run unit tests (graph + pathfinder)
node --test src/*.test.js          # or: npm test

# Validate network data integrity
node scripts/validate-network.js          # exits 0/1 — or: npm run validate
node scripts/validate-network.js --verbose

# Smoke-test the pathfinding engine
node scripts/smoke-test.js         # or: npm run smoke

# Regenerate data/network.json from OSM source data (only when refreshing the network)
node scripts/generate-from-osm.js
```

No build step. No install required for the app itself (`devDependencies` only contains `sharp` for icon generation).

## Architecture

**Stack**: Vanilla JS · HTML · CSS · Web Components · PWA. No framework, no transpiler, no bundler.

**App structure** (`src/app.js` wires everything together): three tabs —
- **Home**: the route finder (`<station-input>` × 2, `<difficulty-selector>`, `<preference-selector>`, `<route-result>`), plus the live weather card (`<weather-hero>`) for whichever resort was resolved via geolocation or manually picked.
- **Resorts**: `<resort-conditions-list>`, a live weather + avalanche overview for all 13 Portes du Soleil resorts, loaded lazily on first visit.
- **Alerts**: `<avalanche-banner>` with the full risk detail; the tab itself only appears in `<tab-bar>` when there's something to show (risk level ≥ 2).

**Route-finding data flow**:
1. `app.js` fetches `data/network.json` on load.
2. `graph.js:loadGraph()` converts the JSON into a `Map<nodeId, Edge[]>` adjacency list. Bidirectional edges are auto-expanded on the second pass.
3. `pathfinder.js:findRoutes()` runs **Yen's K-Shortest Simple Paths** (built on Dijkstra) against that graph. `maxDifficulty` prunes edges above the weight threshold before pathfinding. `preferDifficulty` re-ranks results after collection.
4. Results are passed as a property to the `<route-result>` Web Component, which renders route cards.

**Live conditions data flow** (independent of route-finding):
1. `data/resorts.json` lists all 13 resorts (centroid + elevation) — used both for `<location-gate>`'s nearest-resort geolocation match and as the Resorts tab's overview list.
2. `weather.js:fetchWeather()` hits Open-Meteo (no key required) for live temperature/snow/wind for any lat/lon — always live, works for every resort.
3. `conditions.js:fetchOpenPiste()` + `readAvalanche()` hit the `open-piste` API for live avalanche risk. Coverage is partial (see `data/resorts.json` `_meta` for which resorts it currently has records for); where there's no record, the UI says "unavailable" rather than guessing.
4. `geo.js` provides `nearestResort()`/`haversineKm()`/`VICINITY_KM`, used both by `<location-gate>` (initial resort resolution) and `app.js` (re-checking on every load whether the device is actually near a resort, to decide whether to show the live weather card at all).
5. There is **no lift open/closed status feature** — it was removed deliberately because no live or otherwise-accurate feed exists for it (see `specs/mission.md` non-goals). Don't reintroduce it without a real data source.
6. Nothing in the live-conditions UI ever shows fabricated/example data — a missing reading is always shown as "unavailable," never a placeholder number.

**Difficulty weights** (defined in `graph.js`): silver (lifts) = 1, green = 1, blue = 2, red = 3, black = 4. `silver` difficulty is used exclusively for lift edges.

**Avalanche risk colors**: `--color-avalanche-1` through `-5` in `base.css` follow the official EAWS 5-level danger scale (green/yellow/orange/red/near-black-red — level 5 is officially red with black hatching, which a flat swatch can't reproduce). Fixed across light/dark, like the slope-difficulty tokens, and never reused for general UI. Applied via `[data-level="N"]` on `.resort-ava-dot`, `.hero-avalanche-block`/`.hero-avalanche-icon`/`.hero-avalanche-line`, and `.warning-banner`/`.warning-icon-badge`.

**Node types in `data/network.json`**: `lift-base`, `lift-top`, `junction`, `village`. Junction nodes are routing-internal (slope–slope connections clustered within 75 m) and are filtered out of the station search UI — only lift and village nodes appear to users.

**Roc d'Enfer / Saint-Jean-d'Aulps**: a member resort that is fully routable but is its own self-contained sub-graph — it has no ski-lift link to the rest of Portes du Soleil (only a shuttle bus in real life), so routes never cross between it and the main network. It still appears in the Resorts tab.

**Web Components** (`src/components/`, each self-registers via `customElements.define`):
| Component | Role |
|---|---|
| `<station-input>` | ARIA combobox for lift/village search |
| `<difficulty-selector>` / `<preference-selector>` | Max-difficulty and preferred-difficulty `<select>` wrappers |
| `<route-result>` | Renders route cards from `findRoutes()` output |
| `<tab-bar>` | Bottom nav (Home / Resorts / Alerts) |
| `<location-gate>` | Initial resort resolution prompt (geolocate or pick manually) |
| `<weather-hero>` | Home tab's live weather card — collapsible (single-line strip by default) / expandable (full detail incl. avalanche badge) |
| `<avalanche-banner>` | Avalanche risk banner (used standalone in the Alerts tab) |
| `<resort-conditions-list>` | Resorts tab's per-resort weather + avalanche overview |

**Shared modules** (`src/`, not components): `graph.js`, `pathfinder.js` (route engine), `weather.js`, `conditions.js`, `geo.js` (live-conditions data), `countries.js` (flag/country-name lookups), `format.js` (`relativeTime()`), `icons.js` (the custom SVG icon set — see below).

**Icons**: `src/icons.js` exports `ICONS` (raw inline-SVG strings) and `liftIcon(liftType)`, sourced from the "Ski app icon set" design project (claude.ai/design). No emoji is used for meaningful UI glyphs (tab-bar, route steps) — emoji rendering varies too much across platforms, and it can't distinguish lift types anyway. All icons share one convention: 24×24 viewBox, stroke-only, `currentColor`, 2px stroke width, round caps/joins (so they inherit color automatically, including tab-bar's selected/unselected state — no per-icon CSS needed). Lift icons (`chairlift`/`gondola`/`surface`) additionally share a cable motif and differ only in what hangs from it. When adding a new icon, match this convention rather than introducing a new visual style.

Route-result slope steps also carry a `data-d="{difficulty}"` attribute on the `<li class="route-step">`, tinting the row background to the piste-difficulty colour (`--color-slope-*-bg` tokens in `base.css`, themed for light/dark). Lift steps carry no `data-d` and get no tint.

**CSS architecture**: three files loaded in order — `base.css` (design tokens, reset, Nunito font), `layout.css` (page structure, responsive breakpoints), `components.css` (Web Component styles). Light/dark mode via `prefers-color-scheme` only — no manual toggle. The `--color-hero-*` tokens are a fixed "photo card" surface, deliberately unchanged between light/dark.

**PWA**: `sw.js` is the service worker (cache-first for app shell + data; live-conditions API calls to Open-Meteo/open-piste are always network-only — see the `NETWORK_ONLY_ORIGINS` comment in `sw.js`). `manifest.json` configures installability. `offline.html` is the fallback page. Bump `CACHE_NAME` in `sw.js` whenever `PRECACHE` changes.

## Data

`data/network.json` is the single source of truth for the resort route-finding network at runtime. Schema v2: each node has `id`, `name`, `country`, `station_type`, `lift_type`, and `connections[]`. Connection fields: `to`, `name`, `type` (`lift`|`slope`), `difficulty`, `bidirectional` (optional, default false). It is **generated, not hand-edited** — see below.

`data/portes_du_soleil_graph.json` is the raw OSM/Overpass source data (`lifts`, `pistes`, `edges`) that `network.json` is built from.

`data/resorts.json` is hand-maintained resort metadata (name, country, elevation, lat/lon) for all 13 Portes du Soleil resorts — read its `_meta` field for current open-piste coverage notes.

When editing `network.json` directly (rare — prefer regenerating), run the validator afterwards. The validator checks referential integrity, enum validity, and bidirectional edge consistency.

`scripts/generate-from-osm.js` regenerates `data/network.json` from `data/portes_du_soleil_graph.json`. It clusters piste endpoints within 75 m into routing junctions, auto-bridges lift-to-lift gaps within 400 m, and corrects piste direction using OSM lift-proximity evidence. Where OSM's piste tracing has a genuine, real-world-verified gap (confirmed against an official trip-planning source, not guessed), a small manually-specified edge bridges it — see the `CROSS_SECTOR`, `SJA_SECTOR`, and `CHATEL_SECTOR` arrays near the bottom of the script for examples and the reasoning behind each one. Only add to these when OSM genuinely lacks the geometry, not as a shortcut around debugging the clustering.

## Design constraints

- No JS frameworks. Reusable UI → Web Components only.
- WCAG 2.1 AA compliance required. Every interactive element needs keyboard/ARIA support.
- Mobile-first (primary use case: on-mountain with gloves).
- Country indicators use emoji flags (🇫🇷 🇨🇭) throughout the UI.
- `window-controls-overlay` display mode with graceful fallback.
- Never fabricate data. If a live source has nothing for a given resort/field, say "unavailable" — don't fall back to a hand-maintained placeholder presented as real.

## Specs

`specs/` (gitignored, local reference only) contains phase-by-phase requirements and validation checklists. `specs/tech-stack.md` is the authoritative architecture decision record. `specs/mission.md` defines scope boundaries, including the non-goals (e.g. real-time lift status).
