# Network Expansion: Plan

## Task Group 1: Source Gathering

1.1 Identify official Portes du Soleil sector piste maps (PDF) covering all 13 sub-resorts.  
1.2 Download sector maps: Avoriaz/Morzine/Lindarets/Ardent; Champéry/Les Crosets/Champoussin/Morgins; Châtel/Torgon/La Chapelle d'Abondance; Morzine/Les Gets.  
1.3 Extract lift names, lift types (TK/TSF/TSD/TC/TPH), piste names, and village/col elevations from embedded PDF text layers.  
1.4 Cross-reference the Wikipedia "Portes du Soleil" article for the canonical list of 13 sub-resorts.

## Task Group 2: Graph Synthesis

2.1 Keep the existing 13-node Phase 1 seed graph intact.  
2.2 Add one node per sub-resort not yet represented: Ardent (waypoint), Montriond, Saint-Jean-d'Aulps, La Chapelle d'Abondance, Torgon, Champoussin.  
2.3 Add major-lift edges (gondola/cable car/TSD/TSF only, per D1) connecting each new node into the existing graph, using real named lifts from the source maps.  
2.4 Add a second FR↔CH corridor (`pre-la-joux` ↔ `pointe-de-mossettes` via the "Portes du Soleil" chairlift) to give the pathfinder genuine route alternatives.  
2.5 Do not fabricate edges for villages without documented major-lift access (Abondance, Val-d'Illiez) — see D2.

## Task Group 3: Data File Update

3.1 Update `data/network.json` `_meta.scope` to describe the expanded coverage and methodology.  
3.2 Add the 6 new nodes and ~15 new directed edges to `data/network.json`, following the existing schema exactly.  
3.3 Run `node scripts/validate-network.js` and fix any referential, enum, or bidirectional-consistency errors.

## Task Group 4: Verification

4.1 Confirm all 13 sub-resorts appear as nodes (or are explicitly documented as out of scope).  
4.2 Run `node scripts/smoke-test.js` against the expanded graph (existing Morzine→Champéry route should still resolve).  
4.3 Spot-check 2-3 new routes manually (e.g. Avoriaz → Champoussin, Les Gets → Torgon) for plausibility.

## Task Group 5: Docs

5.1 Update `README.md` "Current coverage" line to reflect the new node count and sub-resort list.
