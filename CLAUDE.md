# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Serve the app (required — fetch() won't work on file://)
npx serve .
# or: python3 -m http.server 8000

# Run unit tests (graph + pathfinder)
node --test src/*.test.js

# Validate network data integrity
node scripts/validate-network.js          # exits 0/1
node scripts/validate-network.js --verbose

# Smoke-test the pathfinding engine
node scripts/smoke-test.js
```

No build step. No install required for the app itself (`devDependencies` only contains `sharp` for icon generation).

## Architecture

**Stack**: Vanilla JS · HTML · CSS · Web Components · PWA. No framework, no transpiler, no bundler.

**Data flow** (runtime):
1. `app.js` fetches `data/network.json` on load.
2. `graph.js:loadGraph()` converts the JSON into a `Map<nodeId, Edge[]>` adjacency list. Bidirectional edges are auto-expanded on the second pass.
3. `pathfinder.js:findRoutes()` runs **Yen's K-Shortest Simple Paths** (built on Dijkstra) against that graph. `maxDifficulty` prunes edges above the weight threshold before pathfinding. `preferDifficulty` re-ranks results after collection.
4. Results are passed as a property to the `<route-result>` Web Component, which renders route cards.

**Difficulty weights** (defined in `graph.js`): silver (lifts) = 1, green = 1, blue = 2, red = 3, black = 4. `silver` difficulty is used exclusively for lift edges.

**Node types in `data/network.json`**: `lift-base`, `lift-top`, `junction`, `village`. Junction nodes are routing-internal (slope–slope connections clustered within 75 m) and are filtered out of the station search UI — only lift and village nodes appear to users.

**Web Components** (`src/components/`): `<station-input>` (ARIA combobox for lift search), `<difficulty-selector>`, `<preference-selector>`, `<route-result>`. Each registers itself via `customElements.define`.

**CSS architecture**: three files loaded in order — `base.css` (design tokens, reset, Nunito font), `layout.css` (page structure, responsive breakpoints), `components.css` (Web Component styles). Light/dark mode via `prefers-color-scheme` only — no manual toggle.

**PWA**: `sw.js` is the service worker (cache-first for app shell + data). `manifest.json` configures installability. `offline.html` is the fallback page.

## Data

`data/network.json` is the single source of truth for the resort network. Schema v2: each node has `id`, `name`, `country`, `station_type`, `lift_type`, and `connections[]`. Connection fields: `to`, `name`, `type` (`lift`|`slope`), `difficulty`, `bidirectional` (optional, default false).

When editing network data, run the validator afterwards. The validator checks referential integrity, enum validity, and bidirectional edge consistency.

`scripts/generate-from-osm.js` regenerates `data/network.json` from an Overpass API query — only needed when refreshing OSM source data.

## Design constraints

- No JS frameworks. Reusable UI → Web Components only.
- WCAG 2.1 AA compliance required. Every interactive element needs keyboard/ARIA support.
- Mobile-first (primary use case: on-mountain with gloves).
- Country indicators use emoji flags (🇫🇷 🇨🇭) throughout the UI.
- `window-controls-overlay` display mode with graceful fallback.

## Specs

`specs/` contains phase-by-phase requirements and validation checklists. `specs/tech-stack.md` is the authoritative architecture decision record. `specs/mission.md` defines scope boundaries.
