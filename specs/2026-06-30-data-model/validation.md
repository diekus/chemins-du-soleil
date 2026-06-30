# Phase 1 — Data Model: Validation

Phase 1 is complete when all of the following checks pass.

---

## 1. File exists and is valid JSON

```
data/network.json
scripts/validate-network.js
```

- `data/network.json` parses without error (`JSON.parse`).
- The top-level value is an object with a `nodes` array.

---

## 2. Validator passes with zero errors

```bash
node scripts/validate-network.js
# Expected: "✓ All checks passed. 0 errors."
# Expected exit code: 0
```

The validator must check and report pass/fail for each of:

| Check | Description |
|---|---|
| No duplicate IDs | Every `node.id` is unique across the file |
| No self-edges | No connection has `to === node.id` |
| Referential integrity | Every `connections[].to` matches an existing node ID |
| Difficulty enum | Every `connections[].difficulty` ∈ {green, blue, red, black} |
| Lift type enum | Every `node.lift_type` ∈ {chairlift, gondola, telecabin, surface, null} |
| Country enum | Every `node.country` ∈ {FR, CH} |
| Connection type enum | Every `connections[].type` ∈ {lift, slope} |
| Bidirectional reverse exists | Every edge with `bidirectional: true` has a matching reverse edge |

---

## 3. Negative test: validator catches a bad reference

Temporarily introduce a connection with a non-existent `to` value (e.g. `"to": "does-not-exist"`), run the validator, confirm:
- Output contains an error message naming the bad reference.
- Exit code is 1.

Revert the change before merging.

---

## 4. Seed data coverage requirements

Manually verify `data/network.json` contains:

- [ ] At least 13 nodes
- [ ] At least 20 directed edges
- [ ] At least 1 node with `country: "FR"` and at least 1 with `country: "CH"`
- [ ] All four difficulty values present: green, blue, red, black
- [ ] At least 1 edge with `bidirectional: true`
- [ ] At least 2 distinct paths between one FR node and one CH node (to allow pathfinding to choose)
- [ ] At least 1 node that is a "dead end" without a bidirectional exit (i.e. accessible only via a `bidirectional: true` edge from another node) — this tests that the engine will handle valley stations correctly in Phase 2

---

## 5. Merge criteria

- [ ] `node scripts/validate-network.js` exits 0 with zero errors on the final file
- [ ] The negative test (check 3 above) was run and confirmed
- [ ] All seed data coverage requirements (check 4) are satisfied
- [ ] `data/network.json` and `scripts/validate-network.js` are committed to the `phase-1-data-model` branch
- [ ] No `src/` changes are included in this branch (pathfinding is Phase 2)
