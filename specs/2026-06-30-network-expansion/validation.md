# Network Expansion: Validation

This phase is complete when all of the following checks pass.

---

## 1. Validator passes with zero errors

```bash
node scripts/validate-network.js
# Expected: "✓ All checks passed. 0 errors."
# Expected exit code: 0
```

Same checks as Phase 1 (referential integrity, enum validity, no duplicate/self-edges, bidirectional reverse-edge consistency).

---

## 2. Sub-resort coverage

Manually verify `data/network.json` contains a node for each of:

- [ ] Avoriaz
- [ ] Morzine
- [ ] Les Gets
- [ ] Châtel
- [ ] La Chapelle d'Abondance
- [ ] Saint-Jean-d'Aulps
- [ ] Montriond
- [ ] Les Crosets
- [ ] Champéry
- [ ] Champoussin
- [ ] Morgins
- [ ] Torgon

(Abondance and Val-d'Illiez are deliberately excluded — see requirements.md D2.)

---

## 3. Graph coverage requirements

- [ ] At least 250 nodes (schema v2: each named lift has a base and summit node)
- [ ] At least 400 directed edges
- [ ] At least 2 distinct FR↔CH crossing corridors (so the pathfinder has genuine route choices, not a single chokepoint)
- [ ] Every new node is reachable from `morzine-village` by at least one path
- [ ] All nodes carry the `station_type` field (village | lift-base | lift-top | junction)

---

## 4. Smoke test

```bash
node scripts/smoke-test.js
```

The existing Morzine → Champéry route must still resolve (the expansion must not break existing connectivity). Manually spot-check 2-3 new routes for plausibility (e.g. a route into Torgon or Champoussin should pass through the expected neighbouring sub-resort, not teleport across the map).

---

## 5. Merge criteria

- [ ] `node scripts/validate-network.js` exits 0 with zero errors
- [ ] All sub-resort coverage and graph coverage checks above pass
- [ ] `README.md` "Current coverage" updated (now shows 262 nodes, 405 edges)
- [ ] `scripts/validate-network.js` validates `station_type` field for schema v2
- [ ] No `src/` or `index.html` changes included in this branch
- [ ] Committed to the `expand-network-data` branch
