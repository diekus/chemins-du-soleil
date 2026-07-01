# Phase 3 — Core UI: Requirements

## Scope

Build the minimum viable single-page application that lets a user find a ski route. No PWA features yet (no manifest, no service worker — those are Phase 4). The app must be runnable by opening `index.html` directly in a browser with no server or build step.

This phase is complete when a user can open the file, pick two stations, set a difficulty, and see route cards — or a clear "no route found" message.

---

## Decisions

### D1: ARIA combobox for station input

The station picker is a `<station-input>` Web Component implementing the ARIA combobox pattern (role="combobox", listbox, option). Accessibility and cross-browser consistency take priority over implementation simplicity. Native `<datalist>` is rejected: its appearance is not styleable, its accessibility behaviour is inconsistent across browsers, and it cannot show country flags inline.

Keyboard contract:
- **Arrow Down**: open dropdown / move selection down
- **Arrow Up**: move selection up
- **Enter**: confirm selection, close dropdown
- **Escape**: discard and close dropdown
- **Tab**: confirm current selection if open, then move focus

### D2: Native `<select>` for difficulty, revisit in backlog

The difficulty selector uses a native `<select>` wrapped in a `<difficulty-selector>` Web Component. The four options are green, blue, red, black. Default is `black` (no restriction).

The dot-button pattern (four coloured radio buttons) described in `BRAND_DESIGN.md` is deferred. Backlog item: replace `<difficulty-selector>` with a coloured-dot picker in Phase 5 polish. The Web Component boundary means this swap is a drop-in replacement with no changes to `app.js` or `index.html`.

### D3: Stacked route cards, all alternatives visible

`<route-result>` renders all routes returned by the engine as stacked cards, sorted cheapest first (the engine already guarantees this). The first card is labelled "Best route"; subsequent cards are "Alternative 2", "Alternative 3". All cards are visible simultaneously — no tabs, no accordion — so the user can compare options at a glance without extra interaction. This matters on the mountain where fast scanning is critical.

### D4: Three Web Components

| Component | File | Appears |
|---|---|---|
| `<station-input>` | `src/components/station-input.js` | Twice (start, destination) |
| `<difficulty-selector>` | `src/components/difficulty-selector.js` | Once |
| `<route-result>` | `src/components/route-result.js` | Once |

Components use the Light DOM (no Shadow DOM). This keeps CSS in external files (simpler, human-readable) and avoids the stylesheet-piercing complexity of Shadow DOM for a single-screen app.

### D5: CSS split across three small files

| File | Contents |
|---|---|
| `css/base.css` | Design tokens (`--color-*`, `--font-*`, `--space-*`), reset, Nunito import, `:root` font |
| `css/layout.css` | Page structure, responsive breakpoints, form/results regions |
| `css/components.css` | Per-component styles: combobox, select, route cards, step rows, difficulty dots, empty/loading states |

Smaller files are easier to review. No preprocessor, no `@layer` (until browser support is universal). `index.html` links all three.

### D6: `app.js` as the sole module entry point

`src/app.js` is the only file loaded from `index.html` (`<script type="module">`). It imports the three component modules (which register the custom elements as a side-effect), fetches the network data, and wires the form events. No inline scripts in HTML.

### D7: Network data loaded via `fetch()`

`app.js` fetches `data/network.json` using the Fetch API. This requires the file to be served (not `file://` protocol). For development, any local server works (`npx serve .`, VS Code Live Server, Python's `http.server`). A note is added to `README.md`.

> Note: `file://` loading of `fetch()` is blocked by browser security. A one-line server command is sufficient.

### D8: Country flags sourced from node metadata

Steps from `findRoutes` carry `{ from, to, name, type, difficulty }` but not `country`. Before passing routes to `<route-result>`, `app.js` augments each step with `country` by looking up the `from` node ID in the `nodeMap`:

```js
step.country = nodeMap.get(step.from)?.country ?? null;
```

`<route-result>` renders `🇫🇷` or `🇨🇭` from `step.country`. This keeps the engine output clean and the mapping logic in one place.

### D9: Three render states for `<route-result>`

| State | `routes` value | Renders |
|---|---|---|
| Idle | `undefined` | Nothing (initial page load) |
| Loading | `null` | Skeleton spinner |
| Results | `Array` (length ≥ 1) | Route cards |
| No route | `Array` (length 0) | "No route found" message |

`app.js` sets `null` before calling the engine and assigns the array immediately after (the engine is synchronous).

---

## File Structure

```
index.html
css/
  base.css
  layout.css
  components.css
data/
  network.json          (Phase 1)
src/
  graph.js              (Phase 2)
  pathfinder.js         (Phase 2)
  components/
    station-input.js
    difficulty-selector.js
    route-result.js
  app.js
```

---

## Backlog Item Added

**Difficulty dot selector**: Replace `<difficulty-selector>`'s native `<select>` with a four-button dot picker using the semantic slope colours from `BRAND_DESIGN.md`. Deferred to Phase 5. The Web Component interface (`value` property, `change` event) must not change when this swap is made.

---

## Alignment with Parent Specs

- `mission.md` §Goals 1–3: this phase delivers the complete user-facing route-finding interaction for the first time.
- `roadmap.md` Phase 3 output: working SPA, no PWA features, runnable from `index.html`.
- `tech-stack.md` §Non-negotiables: vanilla JS, Web Components, WCAG 2.1 AA, responsive, light/dark mode — all implemented here.
- `tech-stack.md` §Visual Design: Nunito font, BRAND_DESIGN tokens, slope colours as semantic-only dots.
- Phase 2 (`findRoutes`, `loadGraph`) is consumed directly. No changes to Phase 2 modules.
