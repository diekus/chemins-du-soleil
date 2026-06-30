# Phase 2 — Pathfinding Engine: Validation

Phase 2 is complete when all of the following checks pass.

---

## 1. Test suite passes with zero failures

```bash
node --test src/*.test.js
# Expected: all tests pass, 0 failures
# Expected exit code: 0
```

---

## 2. Required test cases

Each case must exist as a named test in `src/pathfinder.test.js` or `src/graph.test.js`:

| # | Test name | What it proves |
|---|---|---|
| G1 | `loadGraph builds correct edge count` | Adjacency list has the expected number of edges for a known fixture |
| G2 | `loadGraph safety net inserts missing reverse edge` | A `bidirectional: true` edge without an explicit reverse still produces both directions in the adjacency list |
| G3 | `loadGraph deduplicates when reverse already exists` | A `bidirectional: true` edge with an explicit reverse does not produce a doubled reverse edge |
| P1 | `findRoutes returns correct steps for a known route` | The ordered step list (from, to, name, type, difficulty) matches the expected path for a simple fixture |
| P2 | `findRoutes returns lowest-cost route first` | Given two paths to the same destination, the first result has the lower total cost |
| P3 | `findRoutes respects difficulty filter — blue excludes black edges` | Chavanette (black) is absent from results when maxDifficulty is "blue"; route goes via Grand Conche |
| P4 | `findRoutes returns empty array when no route exists` | Disconnected start/end → `[]`, no throw |
| P5 | `findRoutes handles startId === endId` | Returns one route: `{ path: [id], cost: 0, steps: [] }` |
| P6 | `findRoutes returns k distinct routes when k routes exist` | With `k = 2` and two valid paths, result length is 2 and both paths are different |
| P7 | `findRoutes caps result at available routes, not k` | With `k = 5` and only 2 valid routes, result length is 2 |

---

## 3. Smoke test against real data

```bash
node scripts/smoke-test.js
```

Expected: prints a route array with at least one entry for `morzine-village → champery` at `maxDifficulty: "blue"`. The first route's `path` must include `"champery"` as the last element and `"morzine-village"` as the first.

---

## 4. Module environment check

```bash
# Verify ES module loads in Node without errors
node -e "import('./src/pathfinder.js').then(() => console.log('ok'))"
# Expected output: ok
```

---

## 5. No DOM or file-system dependencies

Manually verify:
- [ ] `src/graph.js` contains no `import fs` or `fetch` calls
- [ ] `src/pathfinder.js` contains no `import fs` or `fetch` calls
- [ ] Neither file references `document`, `window`, or `navigator`

---

## 6. Merge criteria

- [ ] `node --test src/*.test.js` exits 0 with all required test cases present
- [ ] `node scripts/smoke-test.js` prints a valid route from `morzine-village` to `champery`
- [ ] ES module environment check passes
- [ ] No DOM or file-system references in `src/graph.js` or `src/pathfinder.js`
- [ ] `package.json` is committed with `"type": "module"`
- [ ] No UI files (`index.html`, CSS, service worker) are included in this branch — those are Phase 3
