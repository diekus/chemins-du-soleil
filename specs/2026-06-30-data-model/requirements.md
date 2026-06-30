# Phase 1 — Data Model: Requirements

## Scope

Produce `data/network.json` — the single source of truth for the resort network — and `scripts/validate-network.js`, a CLI tool that checks the file for structural and referential correctness.

No UI, no algorithm, no service worker. This phase is complete when the data file exists, is realistic, and passes the validator with zero errors.

---

## Decisions

### D1: Branching subgraph, not a linear corridor

The seed dataset covers a proper subgraph of Portes du Soleil, not just the direct Avoriaz→Champéry corridor. Branching routes are required so that the pathfinding algorithm (Phase 2) can be tested with meaningful cases: multiple valid paths, difficulty-filtered paths that force detours, and routes with no solution.

Minimum coverage:
- French sector: Morzine, Les Gets, Avoriaz, Les Lindarets, Châtel area
- Swiss sector: Pointe de Mossettes, Les Crosets, Champéry, Morgins
- At least two independent paths between one pair of nodes

### D2: Bidirectional flag on connections

Some lifts (cable cars, gondolas) operate in both directions. Some flat traverses between lift stations are walkable in both directions. The connection schema is extended with an optional `bidirectional: true` flag.

When `bidirectional` is absent or `false`, the edge is one-way (the normal case: lifts go up, slopes go down).  
When `bidirectional: true`, the pathfinding engine (Phase 2) must treat the edge as traversable in both directions when building the adjacency list.

The validator checks that every `bidirectional: true` edge has a corresponding reverse edge in the destination node's connections (belt-and-suspenders integrity check).

Examples of bidirectional edges in seed data:
- Champéry ↔ Les Crosets (cable car — required to escape Champéry village)
- Morgins ↔ Les Crosets (gondola)

### D3: Node represents a named station/location, not a lift segment

A node is a named point where a skier stops, boards, or alights — a lift station, a village, or a named junction. A node is not a mid-mountain slope segment.

The `lift_type` field on a node describes the primary lift that serves that station from below. Nodes accessible only on foot or by slope have `lift_type: null` (e.g. Champéry village when approached from above).

### D4: Validator is Node.js CLI, not a browser module

The validator is an authoring tool used by the data maintainer, not part of the web app. It requires Node.js and runs via `node scripts/validate-network.js`. It has zero npm dependencies.

### D5: Difficulty weights are not stored in the data file

Edge weights (green=1, blue=2, red=3, black=4) are a concern of the pathfinding engine (Phase 2), not the data layer. The data layer stores the string difficulty label only. The mapping is defined once in `src/pathfinder.js`.

---

## Node Schema

```json
{
  "id": "avoriaz",
  "name": "Avoriaz",
  "country": "FR",
  "lift_type": "telecabin",
  "connections": [
    {
      "to": "les-lindarets",
      "name": "Lindarets",
      "type": "chairlift",
      "difficulty": "green",
      "bidirectional": false
    }
  ]
}
```

| Field | Type | Values | Required |
|---|---|---|---|
| `id` | string | kebab-case, unique | yes |
| `name` | string | Human-readable display name | yes |
| `country` | string | `FR` or `CH` | yes |
| `lift_type` | string or null | `chairlift`, `gondola`, `telecabin`, `surface`, `button`, `null` | yes |
| `connections[].to` | string | Must match an existing node `id` | yes |
| `connections[].name` | string | Name of slope or lift segment | yes |
| `connections[].type` | string | `lift` or `slope` | yes |
| `connections[].difficulty` | string | `green`, `blue`, `red`, `black` | yes |
| `connections[].bidirectional` | boolean | Default `false` | no |

---

## Seed Data Scope — Portes du Soleil Subgraph

The seed data represents the 2024/25 season network. It covers the main cross-border circuit from Morzine to Champéry and includes the Châtel sub-area.

### Nodes

| ID | Name | Country | Lift Type |
|---|---|---|---|
| `morzine-village` | Morzine | FR | gondola |
| `morzine-pleney` | Pleney | FR | gondola |
| `super-morzine-top` | Super Morzine | FR | gondola |
| `les-gets-chavannes` | Les Gets – Chavannes | FR | chairlift |
| `avoriaz` | Avoriaz | FR | telecabin |
| `les-lindarets` | Les Lindarets | FR | chairlift |
| `pointe-de-mossettes` | Pointe de Mossettes | CH | chairlift |
| `les-crosets` | Les Crosets | CH | gondola |
| `champery` | Champéry | CH | telecabin |
| `morgins` | Morgins | CH | gondola |
| `chatel-village` | Châtel | FR | gondola |
| `pre-la-joux` | Pré-la-Joux | FR | chairlift |
| `super-chatel` | Super-Châtel | FR | chairlift |

### Key Edges (selected)

| From | To | Name | Type | Difficulty | Bidirectional |
|---|---|---|---|---|---|
| `morzine-village` | `super-morzine-top` | Super Morzine | lift | green | true |
| `morzine-village` | `morzine-pleney` | Pleney | lift | green | true |
| `morzine-pleney` | `les-gets-chavannes` | Nantaux | slope | blue | false |
| `les-gets-chavannes` | `avoriaz` | Chavannes | slope | blue | false |
| `morzine-village` | `avoriaz` | Prodains Express | lift | green | false |
| `avoriaz` | `les-lindarets` | Lindarets | lift | green | false |
| `les-lindarets` | `pointe-de-mossettes` | Mossettes Express | lift | green | false |
| `pointe-de-mossettes` | `les-crosets` | Grand Conche | slope | blue | false |
| `pointe-de-mossettes` | `les-crosets` | Chavanette (Swiss Wall) | slope | black | false |
| `les-crosets` | `champery` | Champéry cable car | lift | green | true |
| `les-crosets` | `morgins` | Ripaille | slope | blue | false |
| `morgins` | `les-crosets` | Foilleuse gondola | lift | green | true |
| `chatel-village` | `pre-la-joux` | Super-Châtel gondola | lift | green | false |
| `pre-la-joux` | `super-chatel` | Linga | lift | green | false |
| `super-chatel` | `morgins` | Brochaux | slope | red | false |

---

## Alignment with Parent Specs

- `mission.md` §Goals 1–3: the data model directly supports route finding, difficulty filtering, and cross-border awareness.
- `roadmap.md` Phase 1 output criteria: `data/network.json` with a working subset and a validator.
- `tech-stack.md` §Data: this spec implements the schema defined there, with the addition of the `bidirectional` flag and a `type` field on connections.
- The `difficulty` weight mapping (green=1 … black=4) defined in `tech-stack.md` is not stored in the data file; it belongs in the engine (Phase 2).
