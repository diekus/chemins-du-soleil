# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Serve the app (required — fetch() won't work on file://)
npx serve .
# or: python3 -m http.server 8000

# Run unit tests (graph + pathfinder)
node --test src/*.test.js          # or: npm test

# Validate network data integrity + locale dictionaries (key/placeholder parity across en/fr/es/it)
npm run validate                          # runs both validators, exits 0/1
node scripts/validate-network.js --verbose
node scripts/validate-locales.js --verbose

# Smoke-test the pathfinding engine
node scripts/smoke-test.js         # or: npm run smoke

# Regenerate data/network.json from OSM source data (only when refreshing the network)
node scripts/generate-from-osm.js
```

No build step. No install required for the app itself (`devDependencies` only contains `sharp` for icon generation).

## Architecture

**Stack**: Vanilla JS · HTML · CSS · Web Components · PWA. No framework, no transpiler, no bundler.

**App structure** (`src/app.js` wires everything together): four tabs —
- **Home**: the route finder — a `<swipe-panel>` with two pages, **Route** (`<station-input>` × 2) and **Meet up** (location sharing, see below) — then `<difficulty-selector>`, `<preference-selector>`, `<route-result>`, plus the live weather card (`<weather-hero>`) for whichever resort was resolved via geolocation or manually picked.
- **Resorts**: `<resort-conditions-list>`, a live weather + avalanche overview for all 13 Portes du Soleil resorts, loaded lazily on first visit.
- **Alerts**: `<avalanche-banner>` with the full risk detail; the tab itself only appears in `<tab-bar>` when there's something to show (risk level ≥ 2).
- **Settings**: `<settings-panel>`: language picker (English/French/Spanish/Italian), theme picker (System/Light/Dark) and an Install button (only shown where `navigator.install` exists and the app isn't already running installed). Always visible, unlike Alerts.

**Route-finding data flow**:
1. `app.js` fetches `data/network.json` on load.
2. `graph.js:loadGraph()` converts the JSON into a `Map<nodeId, Edge[]>` adjacency list. Bidirectional edges are auto-expanded on the second pass.
3. `pathfinder.js:findRoutes()` runs **Yen's K-Shortest Simple Paths** (built on Dijkstra) against that graph. `maxDifficulty` prunes edges above the weight threshold before pathfinding. `preferDifficulty` re-ranks results after collection.
4. Results are passed as a property to the `<route-result>` Web Component, which renders route cards.

**Meet up (location sharing) data flow** (`src/meetup.js`, wired in `app.js`'s "Meet up" section):
1. The sharer taps "Share my location" on the Meet up page. Their position is checked with `geo.js:isInPortesDuSoleil()` (within `PDS_AREA_KM` of any network node) and, if inside, `buildMeetUrl()` writes it into a `#meet?lat=..&lon=..&t=..` link sent via `navigator.share`. Sharing is Web Share API only, with no clipboard fallback: where `navigator.share` is missing (`CAN_SHARE_LOCATION` in `app.js`), the share block is hidden and the whole Meet up page (and the Route/Meet up switcher) is hidden via `<swipe-panel>`'s `setPageHidden()` unless an incoming link has been opened — receiving needs no Web Share. If a slow GPS fix outlasts the tap's user activation (`NotAllowedError`), the link is kept and a second tap shares it. There is no server — the position exists only in that link.
2. Opening the link lands on Home with the Meet up page showing an incoming-location card (with "Shared N minutes ago"); the difficulty selects and submit button ("Find route to them") only appear on that page once a valid in-area location has been received.
3. On submit, the receiver's own position is taken (and also must be inside Portes du Soleil), then `findMeetupRoutes()` routes from one of the receiver's nearest `lift-base` nodes to one of the nodes nearest the shared spot (within 300 m), trying a few candidates of each so a self-contained sub-graph or a difficulty ceiling doesn't immediately dead-end it. Returns `already-there` (< 100 m apart) / `at-start` (shared spot is the receiver's nearest lift) without routing.
4. Result cards link to `#route?...&mlat=..&mlon=..`; `<route-detail>`'s `meetPoint` draws the shared spot as a pin with a dashed connector from the route's last node, since that node only approximates it.

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

**La Chapelle-d'Abondance / Crêt-Béni**: same situation as Roc d'Enfer above — its own self-contained sub-graph (Crêt Béni, Prés, Fontaines, Combe, Bambi, Dahu, Cerf, etc.), linked to Châtel/Torgon/the rest of Portes du Soleil only by a free shuttle bus in real life, confirmed against resort trip-planning sources. Don't treat this as a missing-edge bug.

**Web Components** (`src/components/`, each self-registers via `customElements.define`):
| Component | Role |
|---|---|
| `<station-input>` | ARIA combobox for lift/village search |
| `<difficulty-selector>` / `<preference-selector>` | Max-difficulty and preferred-difficulty `<select>` wrappers |
| `<route-result>` | Renders route cards from `findRoutes()` output |
| `<tab-bar>` | Bottom nav (Home / Resorts / Alerts / Settings) |
| `<location-gate>` | Initial resort resolution prompt (geolocate or pick manually) |
| `<weather-hero>` | Home tab's live weather card — collapsible (single-line strip by default) / expandable (full detail incl. avalanche badge) |
| `<avalanche-banner>` | Avalanche risk banner (used standalone in the Alerts tab) |
| `<resort-conditions-list>` | Resorts tab's per-resort weather + avalanche overview |
| `<settings-panel>` | Settings tab: language picker, theme picker, Web Install API button |
| `<swipe-panel>` | Swipeable pages (`data-swipe-page` children) with an ARIA tabs switcher; transform inside `overflow-x: clip` so dropdowns can still overflow vertically |

**Shared modules** (`src/`, not components): `graph.js`, `pathfinder.js` (route engine), `weather.js`, `conditions.js`, `geo.js` (live-conditions data), `meetup.js` (location-sharing links + routing), `countries.js` (flag/country-name lookups), `format.js` (`relativeTime()`, locale-aware via `i18n.js`), `icons.js` (the custom SVG icon set — see below), `route-view.js` (shared route-step/badge rendering used by `<route-result>` and `<route-detail>`).

**Localization** (`src/i18n.js` + `locale/{en,fr,es,it}.json`): flat JSON dictionaries, no framework. `t(key, params?)` looks up the active locale's string (falling back to English, never to the raw key) and interpolates `{placeholder}` tokens; `params.count` selects a `_one`/`_other` pluralized variant when present. `setLocale(code)` persists the choice to `localStorage` (`cds:locale`) and dispatches a `localechange` event on `window` — every component that renders translatable text listens for it in `connectedCallback()` and re-renders. The active locale is resolved once at module-evaluation time via a real top-level `await` in `i18n.js`, so every Web Component module (which upgrades already-parsed DOM elements the instant it calls `customElements.define()`) waits for the dictionary before its first render — this is what prevents a flash of raw translation keys or English text on a non-English first load. `navigator.language` picks the initial locale when there's no stored override. Proper nouns (lift/piste/resort/village names) are never translated. Run `node scripts/validate-locales.js` after editing any `locale/*.json` file — it checks key-set and `{placeholder}` parity across all four dictionaries. `SUPPORTED_LOCALES` in `i18n.js` is the single list to extend when adding another language.

**Icons**: `src/icons.js` exports `ICONS` (raw inline-SVG strings) and `liftIcon(liftType)`, sourced from the "Ski app icon set" design project (claude.ai/design). No emoji is used for meaningful UI glyphs (tab-bar, route steps) — emoji rendering varies too much across platforms, and it can't distinguish lift types anyway. All icons share one convention: 24×24 viewBox, stroke-only, `currentColor`, 2px stroke width, round caps/joins (so they inherit color automatically, including tab-bar's selected/unselected state — no per-icon CSS needed). Lift icons (`chairlift`/`gondola`/`surface`) additionally share a cable motif and differ only in what hangs from it. When adding a new icon, match this convention rather than introducing a new visual style.

**Chevrons**: every chevron (expand/collapse toggles, dropdowns) follows the weather card's: `ICONS.chevronDown` wrapped in the shared `.chevron` class (`css/components.css`: 1.375rem, 60% opacity; add `.chevron--up` to rotate it). Never use a text glyph (`⌄`, `▾`, `v`) or the browser's native `<select>` arrow; selects draw the same glyph via the themed `--select-chevron` token in `base.css` (stroke colour baked in, so keep its light/dark values in sync with `--color-text`). Give the chevron enough clear space (at least `--sp-3`) from adjacent text.

Route-result slope steps also carry a `data-d="{difficulty}"` attribute on the `<li class="route-step">`, tinting the row background to the piste-difficulty colour (`--color-slope-*-bg` tokens in `base.css`, themed for light/dark). Lift steps carry no `data-d` and get no tint.

**CSS architecture**: four files loaded in order — `base.css` (design tokens, reset, Nunito font), `layout.css` (page structure, responsive breakpoints), `components.css` (Web Component styles), `foldable.css` (foldable-device layout overrides — see below). Light/dark mode follows `prefers-color-scheme` by default; the Settings theme picker (`src/theme.js`, stored in `localStorage` as `cds:theme`) can force either via `[data-theme="light|dark"]` on `<html>`, applied pre-paint by an inline script in `index.html`. Any dark-only CSS rule therefore needs both `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }` and `:root[data-theme="dark"] …`. Elements with a scheme-dependent `media` attribute (theme-color metas, header logo `<source>`) carry `data-scheme` so `theme.js` can retarget them. The `--color-hero-*` tokens are a fixed "photo card" surface, deliberately unchanged between light/dark.

**Foldable device support**: `css/foldable.css` adapts the route-detail tab for foldables used half-open, in two postures. *Flip-style* (Galaxy Z Flip and equivalents — one horizontal fold, 2 segments stacked top/bottom): the map pins to the top segment, the route steps/share button to the bottom segment as their own scrollable panel; gated by `@media (device-posture: folded) and (vertical-viewport-segments: 2) and (horizontal-viewport-segments: 1)`. *Book-style* (Galaxy Z Fold 8 / Fold 8 Ultra and equivalents — one vertical fold, 2 segments side by side): the map pins to the left segment, the route to the right segment as its own scrollable panel, and below 900px the tab-bar pill re-centres on the right segment (only while route detail is showing) so it doesn't straddle the fold; gated by `@media (device-posture: folded) and (horizontal-viewport-segments: 2) and (vertical-viewport-segments: 1)`. The layout is pure CSS (posture and `env(viewport-segment-*)` geometry are native CSS features). The only JS is in `route-detail.js`: `matchMedia` listeners on those same two queries rebuild the Leaflet map when the posture changes, because folding resizes the map card without resizing the viewport. Has zero effect on any device that doesn't match either query. The Home tab (and Resorts/Alerts/Settings) are deliberately out of scope — Home's layout and its tab-bar pill stay identical regardless of posture, by design (an earlier version relocated the pill and pinned the search form/results too; removed at the user's request). See `specs/2026-09-28-foldable-support/` for the full spec.

**PWA**: `sw.js` is the service worker (cache-first for app shell + data; live-conditions API calls to Open-Meteo/open-piste are always network-only — see the `NETWORK_ONLY_ORIGINS` comment in `sw.js`). `manifest.json` configures installability. `offline.html` is the fallback page. Bump `CACHE_NAME` in `sw.js` whenever `PRECACHE` changes.

## Data

`data/network.json` is the single source of truth for the resort route-finding network at runtime. Schema v3: each node has `id`, `name`, `country`, `station_type`, `lift_type`, `lat`, `lon`, and `connections[]`. Connection fields: `to`, `name`, `type` (`lift`|`slope`), `difficulty`, `bidirectional` (optional, default false). It is **generated, not hand-edited** — see below.

**Node coordinates (`lat`/`lon`, schema v3)**: lift-base/lift-top nodes use their OSM base/top station coordinates; junction nodes use the centroid of the piste endpoints clustered into them; village nodes reuse the matching resort's centroid from `data/resorts.json` (there's no OSM point for a village itself). These back the live GPS route-progress feature on the route detail page (`geo.js:projectOntoRoute()`) — a device position is matched to the nearest point along the selected route's node-to-node polyline to estimate progress. Coordinates are approximate (junction centroids and village centroids, not surveyed piste centerlines), so progress matching is inherently a nearest-node approximation, not turn-by-turn navigation.

`data/portes_du_soleil_graph.json` is the raw OSM/Overpass source data (`lifts`, `pistes`, `edges`) that `network.json` is built from.

`data/resorts.json` is hand-maintained resort metadata (name, country, elevation, lat/lon) for all 13 Portes du Soleil resorts — read its `_meta` field for current open-piste coverage notes.

When editing `network.json` directly (rare — prefer regenerating), run the validator afterwards. The validator checks referential integrity, enum validity, coordinate sanity (each node's lat/lon falls within the Portes du Soleil bounding box), and bidirectional edge consistency.

`scripts/generate-from-osm.js` regenerates `data/network.json` from `data/portes_du_soleil_graph.json`. It clusters piste endpoints within 75 m into routing junctions, auto-bridges lift-to-lift gaps within 400 m, and corrects piste direction using OSM lift-proximity evidence. Where OSM's piste tracing has a genuine, real-world-verified gap (confirmed against an official trip-planning source, not guessed), a small manually-specified edge bridges it — see the `CROSS_SECTOR`, `SJA_SECTOR`, `CHATEL_SECTOR`, and `CHATEL_VILLAGE_SECTOR` arrays near the bottom of the script for examples and the reasoning behind each one. Only add to these when OSM genuinely lacks the geometry, not as a shortcut around debugging the clustering.

**Châtel village node (`chatel-village`)**: Châtel's own lift network has no shared lift/piste between its two sectors — Super-Châtel/Barbossine (gondola from the village centre) and Linga/Pré-la-Joux (chairlift ~1.8km away) — skiers transfer via the village itself, same as Morzine's village bridges. `CHATEL_VILLAGE_SECTOR` models this. Without it, the entire Super-Châtel/Barbossine sector (Morclan, Panthiaz, Corbeau, Coqs, Conches, Petit Châtel, etc.) was an orphaned sub-graph unreachable from the rest of Portes du Soleil, discovered via a full connected-components audit.

## Design constraints

- No JS frameworks. Reusable UI → Web Components only.
- WCAG 2.1 AA compliance required. Every interactive element needs keyboard/ARIA support.
- Mobile-first (primary use case: on-mountain with gloves).
- Country indicators use emoji flags (🇫🇷 🇨🇭) throughout the UI.
- `window-controls-overlay` display mode with graceful fallback.
- Never fabricate data. If a live source has nothing for a given resort/field, say "unavailable" — don't fall back to a hand-maintained placeholder presented as real.

## Specs

`specs/` (gitignored, local reference only) contains phase-by-phase requirements and validation checklists. `specs/tech-stack.md` is the authoritative architecture decision record. `specs/mission.md` defines scope boundaries, including the non-goals (e.g. real-time lift status).
