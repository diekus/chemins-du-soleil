# Roadmap

Each phase produces something runnable. No phase depends on future phases to be testable.

---

## Phase 1 — Data Model

Define and populate the resort network data.

- Design the `network.json` schema (nodes, edges, difficulty, country, lift type).
- Seed initial data: a representative subset of Portes du Soleil lifts and slopes sufficient to test real routes (e.g. Avoriaz → Champéry corridor).
- Write a simple validator script that checks the JSON for referential integrity (no edge pointing to a non-existent node).

**Output**: `data/network.json` with a working subset of the resort, plus a validator.

---

## Phase 2 — Pathfinding Engine

Implement the core algorithm as a pure JavaScript module with no DOM dependencies.

- Load and parse `network.json`.
- Build an adjacency list representation of the directed weighted graph.
- Implement Dijkstra's shortest-path algorithm.
- Implement difficulty filtering: remove edges above the chosen threshold before running the algorithm.
- Handle the no-route-found case explicitly.
- Write unit tests covering: basic route, filtered route, no route exists, single-node input.

**Output**: `src/graph.js` + `src/pathfinder.js`, tested and working in isolation.

---

## Phase 3 — Core UI

Build the minimum viable interface to use the pathfinding engine.

- HTML shell: start input, destination input, difficulty selector (green / blue / red / black), "Find route" button.
- Autocomplete / searchable dropdown for lift names (sourced from `network.json`).
- Display the result: ordered list of steps (lift → slope → lift) or a clear "no route found" message.
- Country flags (🇫🇷 🇨🇭) on every lift name in the UI.
- Basic responsive layout (mobile-first).
- Light/dark mode via `prefers-color-scheme`.

**Output**: Working single-page app, no PWA features yet. Runnable by opening `index.html`.

---

## Phase 4 — PWA Shell

Make the app installable and offline-capable.

- Add `manifest.json` (name, short_name, icons, display, theme_color, shortcuts).
- Implement Service Worker: cache-first strategy for app shell and `network.json`.
- Offline fallback page for uncached resources.
- `window-controls-overlay` display mode with fallback.
- Verify installability criteria in Chrome DevTools / Lighthouse.

**Output**: Installable PWA scoring green on Lighthouse PWA audit.

---

## Phase 5 — Polish & Advanced Capabilities

Refine the experience and add progressive enhancements.

- Animations and transitions (route reveal, loading states).
- Web Share API: share a route as text with another person.
- App shortcuts in manifest (e.g. "New route").
- Full data: complete Portes du Soleil network in `network.json`.
- WCAG audit and fixes.
- Cross-browser testing (iOS Safari, Android Chrome, desktop).

**Output**: Production-quality app ready for public use.

---

## Backlog (Post-Launch)

These features are deliberately deferred until the core app is stable.

- **Geolocation**: Detect nearest lift automatically and pre-fill the start input.
- **Map view**: Visual map of the resort with the calculated route overlaid.
- **Real-time lift status**: Integration with resort APIs or manual status flags in the data file.
- **Favourites**: Save frequently used routes across sessions (via `localStorage`).
- **Multi-language**: French and English UI strings.
