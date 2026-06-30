# Phase 2 — Pathfinding Engine: Plan

## Task Group 1: Project Setup

1.1 Create `package.json` at the repo root — sets `"type": "module"` for ES module support across Node and browser. No runtime dependencies. `"engines"` pinned to Node ≥ 18 (required for `node:test`).  
1.2 Create the `src/` directory.

## Task Group 2: Graph Module (`src/graph.js`)

2.1 Implement `loadGraph(networkJson)` — accepts the parsed `network.json` object and returns an adjacency list as a `Map<nodeId, Edge[]>`.  
2.2 Build the adjacency list: for every connection, add a directed edge with its `weight` derived from the difficulty mapping (green=1, blue=2, red=3, black=4).  
2.3 Implement the bidirectional safety net: for every edge flagged `bidirectional: true`, add the reverse direction if it is not already present. This protects the engine against hand-edits that remove one side of a bidirectional pair.  
2.4 Export `loadGraph` and the `DIFFICULTY_WEIGHT` mapping as named exports.

## Task Group 3: Pathfinder Module (`src/pathfinder.js`)

3.1 Implement `findRoutes(graph, startId, endId, maxDifficulty, k = 3)` — returns an array of up to `k` distinct lowest-cost routes, sorted ascending by total cost.  
3.2 Implement difficulty filtering: when building the candidate graph for a given call, omit any edge whose weight exceeds `DIFFICULTY_WEIGHT[maxDifficulty]`.  
3.3 Implement single-path Dijkstra as the inner primitive.  
3.4 Implement Yen's K-Shortest Simple Paths algorithm on top of Dijkstra to produce up to `k` alternatives.  
3.5 Handle the no-route-found case: return an empty array `[]` (never throw).  
3.6 Handle the degenerate case: `startId === endId` returns `[{ path: [startId], cost: 0, steps: [] }]`.  
3.7 Each returned route is a plain object: `{ path: string[], cost: number, steps: Step[] }` where a `Step` is `{ from, to, name, type, difficulty }`.  
3.8 Export `findRoutes` as a named export.

## Task Group 4: Unit Tests

4.1 Create `src/graph.test.js` — tests for `loadGraph`:  
    — Correct number of edges loaded from fixture data.  
    — Bidirectional safety net adds the missing reverse edge.  
    — Unknown difficulty value is handled without crash.

4.2 Create `src/pathfinder.test.js` — tests for `findRoutes`:  
    — **Basic route**: known start/end with an obvious path returns the correct ordered steps.  
    — **Optimal route**: when two paths exist (e.g. Grand Conche blue vs Chavanette black), the lowest-cost path is returned first.  
    — **Filtered route**: with `maxDifficulty: "blue"`, the black Chavanette edge is excluded and the algorithm routes via Grand Conche only.  
    — **No route exists**: start and end in disconnected components returns `[]`.  
    — **Single-node input**: `startId === endId` returns one route with zero cost.  
    — **K alternatives**: requesting `k = 2` returns exactly two distinct routes when two exist.  
    — **K capped**: requesting `k = 5` when only 2 routes exist returns 2, not 5.

4.3 Run all tests: `node --test`.

## Task Group 5: Smoke Test Against Real Data

5.1 Write `scripts/smoke-test.js` — loads `data/network.json`, calls `findRoutes("morzine-village", "champery", "blue", 3)`, and prints the result. Not a formal test; used to verify the engine works end-to-end on real data before Phase 3 integration.
