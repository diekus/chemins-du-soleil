# Phase 3 — Core UI: Plan

## Task Group 1: File Structure

1.1 Create `css/` directory with three files: `base.css`, `layout.css`, `components.css`.  
1.2 Create `src/components/` directory for Web Component modules.  
1.3 Create `src/app.js` as the module entry point.  
1.4 Create `index.html` shell with all script and stylesheet wiring.

## Task Group 2: CSS — Tokens and Base Styles (`css/base.css`)

2.1 Declare all design tokens as CSS custom properties (colors, typography, spacing, border-radius) per `BRAND_DESIGN.md`.  
2.2 Implement `prefers-color-scheme: dark` overrides for all tokens — no new hues, strict inversion.  
2.3 Add minimal reset (box-sizing, margin, padding).  
2.4 Import Nunito from Google Fonts; set base `font-family` on `:root`.

## Task Group 3: CSS — Layout (`css/layout.css`)

3.1 Full-height single-column layout centred at a max-width of ~480 px (phone-first).  
3.2 Form area at top; results area below, scrollable independently.  
3.3 Desktop breakpoint (≥ 640 px): widen the card, add comfortable padding.

## Task Group 4: CSS — Component Styles (`css/components.css`)

4.1 `<station-input>` host styles: combobox input, dropdown list, focused/selected option states.  
4.2 `<difficulty-selector>` host styles: labelled select element, consistent with input styling.  
4.3 `<route-result>` host styles: card surface, cost badge, step rows (icon + name + flag + difficulty dot), "no route found" empty state.  
4.4 Slope difficulty dots: four coloured circles using the semantic colours from `BRAND_DESIGN.md` — not reused for any other UI purpose.

## Task Group 5: `<station-input>` Web Component (`src/components/station-input.js`)

5.1 Implement ARIA combobox pattern (role="combobox", aria-expanded, aria-controls, aria-autocomplete="list").  
5.2 Filter station list on input (case-insensitive substring match on name).  
5.3 Display country flag (🇫🇷 / 🇨🇭) alongside each option and in the selected value.  
5.4 Keyboard: Arrow Down/Up navigate options; Enter selects; Escape closes; Tab closes.  
5.5 Expose `value` property (selected node ID) and dispatch a `change` CustomEvent on selection.  
5.6 Accept `stations` property (array of `{ id, name, country }`) set by `app.js` after data load.  
5.7 Accept `placeholder` attribute.

## Task Group 6: `<difficulty-selector>` Web Component (`src/components/difficulty-selector.js`)

6.1 Render a `<label>` + native `<select>` with the four difficulty options (green → blue → red → black).  
6.2 Default value: `black` (no restriction — all routes visible by default).  
6.3 Expose `value` property and dispatch `change` CustomEvent on selection.

## Task Group 7: `<route-result>` Web Component (`src/components/route-result.js`)

7.1 Accept a `routes` property (array of route objects from `findRoutes`) and a `nodes` property (Map of node metadata for country lookup).  
7.2 Render one card per route, stacked vertically, best route first.  
7.3 Each card header: "Best route" (first) or "Alternative N" label, total cost as a subtle badge.  
7.4 Each step row: lift/slope icon (🚡 / ⛷️), connection name, country flag of the departure node, difficulty dot.  
7.5 Empty state (routes = []): render a clear "No route found" message with a brief explanation.  
7.6 Loading state (routes = null): render a skeleton / spinner.  
7.7 Initial state (routes = undefined): render nothing (idle).

## Task Group 8: `app.js` — Orchestration (`src/app.js`)

8.1 `fetch('data/network.json')` on load → parse → `loadGraph()` → populate `<station-input>` elements.  
8.2 Build a `nodeMap` (Map of id → node) from network data for country lookup in `<route-result>`.  
8.3 Listen for form submit; prevent default.  
8.4 Validate that start ≠ end before calling the engine (show inline error if equal).  
8.5 Set `routes = null` on `<route-result>` (loading state) before the (synchronous) engine call.  
8.6 Call `findRoutes(graph, startId, endId, maxDifficulty, 3)`.  
8.7 Pass result and `nodeMap` to `<route-result>`.

## Task Group 9: `index.html` Shell

9.1 Semantic HTML: `<header>` with logo/wordmark, `<main>` with the form and results.  
9.2 Form: two `<station-input>` elements, one `<difficulty-selector>`, one submit `<button>`.  
9.3 `<route-result>` element below the form.  
9.4 All stylesheets linked; `src/app.js` loaded as `<script type="module">`.  
9.5 `<meta name="viewport" content="width=device-width, initial-scale=1">` and `lang="en"` on `<html>`.

## Task Group 10: Manual Testing

10.1 Open `index.html` in Chrome and Firefox — no server required.  
10.2 Test the golden path: Morzine → Champéry at max blue → 3 route cards appear.  
10.3 Test no-route case: two disconnected nodes → "No route found" message.  
10.4 Test combobox keyboard navigation: arrow keys, Enter, Escape.  
10.5 Test light/dark mode by toggling system preference.  
10.6 Test on a narrow viewport (375 px) and a wide viewport (1280 px).  
10.7 Test same-start-end inline error.
