# Phase 1 — Data Model: Plan

## Task Group 1: Schema Design

1.1 Finalise the `network.json` node schema (extend `tech-stack.md` baseline).  
1.2 Extend the connection schema with a `bidirectional` flag for two-way lifts and traverses.  
1.3 Document the edge weight mapping (green=1, blue=2, red=3, black=4) in `tech-stack.md` or inline in the data file header comment.

## Task Group 2: Seed Data

2.1 Create `data/network.json` with the Avoriaz–Champéry corridor as a branching subgraph.  
    — Target: ~14 nodes, ~25 directed edges, covering FR and CH, all four difficulty levels.  
    — Nodes to include: Morzine Village, Pleney, Super Morzine Top, Les Gets (Chavannes), Avoriaz, Les Lindarets, Pointe de Mossettes, Les Crosets, Champéry, Morgins, Châtel Village, Pré-la-Joux, Super-Châtel.  
    — Must include at least two independent paths between one pair of nodes (for algorithm testing).  
    — Must include at least one FR↔CH crossing edge.  
    — Must include at least one bidirectional edge (e.g. Champéry cable car).  
    — Must include at least one dead-end node resolvable only by bidirectional edge (Champéry village).

2.2 Verify all real-world lift names and slope names against available public resort data (portesdusoleil.com, avoriaz.com).  
2.3 Add a short comment block at the top of the JSON file noting the season the data represents and the geographic scope.

## Task Group 3: Validator Script

3.1 Create `scripts/validate-network.js` as a plain Node.js CLI script (no dependencies).  
3.2 Implement checks:  
    — Referential integrity: every `to` value in every connection references an existing node ID.  
    — Enum validity: `difficulty` ∈ {green, blue, red, black}; `lift_type` ∈ {chairlift, gondola, telecabin, surface}; `country` ∈ {FR, CH}.  
    — No duplicate node IDs.  
    — No self-referencing edge (`to` !== own node ID).  
    — Bidirectional consistency: if an edge is flagged `bidirectional: true`, the reverse edge must also exist.  
3.3 Output: coloured pass/fail per check, total error count, exit code 1 on any failure.

## Task Group 4: Validation Run

4.1 Run `node scripts/validate-network.js` against the seed data and confirm zero errors.  
4.2 Intentionally introduce one referential error, confirm validator catches it, then revert.
