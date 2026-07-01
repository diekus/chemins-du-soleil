# Chemins du Soleil

A ski route-finding progressive web app for the [Portes du Soleil](https://en.portesdusoleil.com/) resort area.

Given a start lift, a destination, and an optional maximum slope difficulty, the app returns the best route — or clearly states no route exists under those constraints. It works offline once installed.

---

## Status

| Phase | Description | Status |
|---|---|---|
| 1 | Data Model | ✓ Complete |
| 2 | Pathfinding Engine | ✓ Complete |
| 3 | Core UI | ✓ Complete |
| 4 | PWA Shell | Pending |
| 5 | Polish & Advanced Capabilities | Pending |

See [`specs/roadmap.md`](specs/roadmap.md) for the full plan.

---

## Running the app

The app uses `fetch()` to load resort data, which requires an HTTP server — it will not work opened directly as a `file://` URL.

```bash
# Any of these work from the repo root:
npx serve .
python3 -m http.server 8000
# Then open http://localhost:8000
```

---

## Data

The resort network is stored in [`data/network.json`](data/network.json) as a directed weighted graph of lift stations and slope connections.

Current coverage: **606 nodes, 882 directed edges** — OSM-derived network with piste junction nodes (schema v2). Source: OpenStreetMap / Overpass API. Every named lift has its own base and summit node. Piste endpoints within 75 m of each other are clustered into junction nodes, enabling slope-to-slope routing without requiring a lift transition. Cross-resort corridors and the Saint-Jean-d'Aulps domain are supplemented with manually-specified edges. Resorts covered: Avoriaz, Morzine, Les Gets, Châtel, La Chapelle d'Abondance, Montriond, Saint-Jean-d'Aulps (🇫🇷) and Champéry, Les Crosets, Morgins (🇨🇭). Generator: [`scripts/generate-from-osm.js`](scripts/generate-from-osm.js). See [`specs/2026-06-30-network-expansion/`](specs/2026-06-30-network-expansion/) for scope.

### Validate the data

Requires Node.js. No install step.

```bash
node scripts/validate-network.js
```

Checks referential integrity, enum validity, and bidirectional edge consistency. Exits 0 on success, 1 on any error. Add `--verbose` to see a pass line for every individual check.

---

## Project structure

```
index.html
css/
  base.css              Design tokens, reset, Nunito font
  layout.css            Page structure, responsive breakpoints
  components.css        Web Component styles
data/
  network.json          Resort network (nodes + edges)
src/
  graph.js              Adjacency list builder
  pathfinder.js         Dijkstra + Yen's K-shortest paths
  app.js                App entry point
  components/
    station-input.js    ARIA combobox Web Component
    difficulty-selector.js  Difficulty select Web Component
    route-result.js     Route cards Web Component
scripts/
  validate-network.js   CLI data validator
  smoke-test.js         Engine smoke test
specs/
  mission.md            What we're building and why
  roadmap.md            Phase-by-phase delivery plan
  tech-stack.md         Platform, algorithm, schema, and design decisions
  2026-06-30-data-model/       Phase 1 spec
  2026-06-30-pathfinding-engine/ Phase 2 spec
  2026-06-30-core-ui/          Phase 3 spec
  2026-06-30-network-expansion/ Network data expansion spec
images/
  icon.png
  logo.png
prompts/
  constitution.md       AI collaboration guidelines
  pwa.md                PWA reference
  BRAND_DESIGN.md       Visual design brief
```

---

## Tech

Vanilla JavaScript · HTML · CSS · Web Components · No build step · PWA

See [`specs/tech-stack.md`](specs/tech-stack.md) for the full stack decision record.
