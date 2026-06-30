# Phase 2 — Pathfinding Engine: Requirements

## Scope

Produce two pure JavaScript modules — `src/graph.js` and `src/pathfinder.js` — and their unit tests. No DOM, no service worker, no UI. The modules must run identically in Node (for tests) and in the browser (for Phase 3 integration) using ES module syntax.

This phase is complete when `node --test` passes all cases and the smoke test returns a sensible route from `morzine-village` to `champery`.

---

## Decisions

### D1: ES Modules with `"type": "module"` in `package.json`

Both `src/graph.js` and `src/pathfinder.js` use `export`/`import` syntax. A minimal `package.json` at the repo root sets `"type": "module"` so Node resolves `.js` files as ESM without requiring `.mjs` extensions. This is consistent with the browser target — no build step is ever required.

`package.json` has no runtime dependencies. `"engines": { "node": ">=18" }` is set because `node:test` (the built-in test runner) is stable from Node 18.

### D2: `node:test` as the test runner

Node 18's built-in `node:test` module requires no install and produces TAP output. Tests run with a single command: `node --test`. This is consistent with the project's no-build-step, no-dependency philosophy.

Tests live in `src/*.test.js` and are discovered automatically by `node --test src/*.test.js`.

### D3: Two-module split — `graph.js` and `pathfinder.js`

`graph.js` owns data loading and graph construction. `pathfinder.js` owns the algorithm. This split lets Phase 3 import only `pathfinder.js` (which imports `graph.js` internally) and also lets tests mock the graph in isolation.

### D4: Bidirectional safety net in `graph.js`

When building the adjacency list, `loadGraph` checks every edge flagged `bidirectional: true` and inserts the reverse edge if it is absent. This is a defence-in-depth measure: the Phase 1 validator already enforces the reverse, but hand-edits can break that. The safety net ensures the engine never silently produces wrong routes because one side of a bidirectional pair was accidentally removed.

Deduplication: if the reverse edge already exists (normal case), it is not added a second time. Equality is checked by matching `to` and `name`.

### D5: Yen's K-Shortest Simple Paths for alternatives

`findRoutes` returns up to `k` distinct, loop-free routes sorted by ascending total cost. The algorithm used is Yen's K-Shortest Simple Paths, which is correct and well-understood.

`k` defaults to 3. The caller can pass any positive integer. If fewer than `k` distinct routes exist (including the filtered graph), the function returns however many it found — it never pads with duplicates or throws.

### D6: Return type is a plain data object, no classes

A route is a plain JS object — no prototype, no class. This makes it trivially serialisable and easy for Phase 3 to render without any import dependency on the engine's internals.

```js
{
  path: ["morzine-village", "avoriaz", "les-lindarets", "pointe-de-mossettes", "les-crosets", "champery"],
  cost: 7,
  steps: [
    { from: "morzine-village", to: "avoriaz",           name: "Prodains Express", type: "lift",  difficulty: "green" },
    { from: "avoriaz",         to: "les-lindarets",      name: "Lindarets",        type: "lift",  difficulty: "green" },
    { from: "les-lindarets",   to: "pointe-de-mossettes","name": "Mossettes Express","type": "lift", "difficulty": "green" },
    { from: "pointe-de-mossettes","to": "les-crosets",   name: "Grand Conche",     type: "slope", difficulty: "blue"  },
    { from: "les-crosets",     to: "champery",            name: "Champéry cable car","type": "lift", difficulty: "green" }
  ]
}
```

### D7: Difficulty filtering is applied before the algorithm runs

When `findRoutes` is called with a `maxDifficulty`, edges above that threshold are removed from the graph view before Dijkstra runs. This matches the mission requirement: a filtered graph that produces "no route" is an explicit, correct answer, not a fallback.

Difficulty weight mapping (defined once in `graph.js`, exported as `DIFFICULTY_WEIGHT`):

| Difficulty | Weight |
|---|---|
| green | 1 |
| blue | 2 |
| red | 3 |
| black | 4 |

### D8: `graph.js` does not perform file I/O

`loadGraph` accepts the already-parsed network object, not a file path. File reading is the caller's concern (a one-liner using `fs/promises` + `JSON.parse` in Node, or a `fetch` + `.json()` in the browser). This keeps the module environment-agnostic.

---

## Public API

### `src/graph.js`

```js
import { loadGraph, DIFFICULTY_WEIGHT } from './graph.js';

const graph = loadGraph(networkJson);
// graph: Map<nodeId: string, edges: Array<{ to, name, type, difficulty, weight }>>

// DIFFICULTY_WEIGHT: { green: 1, blue: 2, red: 3, black: 4 }
```

### `src/pathfinder.js`

```js
import { findRoutes } from './pathfinder.js';

const routes = findRoutes(graph, startId, endId, maxDifficulty, k = 3);
// routes: Array<{ path: string[], cost: number, steps: Step[] }>
// Empty array if no route exists under the given constraints.

// Step: { from: string, to: string, name: string, type: "lift"|"slope", difficulty: string }
```

---

## Alignment with Parent Specs

- `mission.md` §Goals 1–2: route finding and difficulty filtering are the direct outputs of this phase.
- `roadmap.md` Phase 2 output criteria: `src/graph.js` + `src/pathfinder.js`, tested and working in isolation.
- `tech-stack.md` §Core Algorithm: this phase implements the Dijkstra-on-weighted-graph algorithm described there. The weight mapping (green=1 … black=4) defined in `tech-stack.md` is implemented here for the first time.
- `tech-stack.md` §Data: `loadGraph` consumes the schema defined there.
- Phase 1 output (`data/network.json`) is the primary test fixture via the smoke test. Unit tests use inline fixture objects to remain isolated.
