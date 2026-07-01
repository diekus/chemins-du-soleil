# Network Expansion — Requirements

## Scope

Expand `data/network.json` from the Phase 1 seed (13 nodes, one cross-border corridor) to a major-lift backbone covering all 13 named Portes du Soleil sub-resorts. This pulls forward the Phase 5 backlog item "Full data: complete Portes du Soleil network in `network.json`" ahead of Phase 4 (PWA Shell), at the user's request.

No UI or engine changes. This phase is complete when `data/network.json` passes the validator with zero errors and every named sub-resort is reachable in the graph.

---

## Decisions

### D1: Major lifts only

A connection is included only if it is a gondola (TC), cable car (TPH), or high-speed/major chairlift (TSD/TSF) that links one named station or sub-resort to another. Short beginner drag lifts (TK) and button lifts that serve a single nursery slope within one sector are explicitly out of scope — they don't affect cross-resort routing, which is this app's purpose.

### D2: All 13 sub-resorts represented, but only where a major lift exists

Target sub-resorts: Avoriaz, Morzine, Les Gets, Châtel, La Chapelle d'Abondance, Saint-Jean-d'Aulps, Montriond (France); Les Crosets, Champéry, Champoussin, Morgins, Torgon (Switzerland).

Abondance and Val-d'Illiez appear on official Portes du Soleil maps as named villages within the wider geographic area, but neither has a documented major lift connecting it into the skiable circuit (both are valley towns reached by road). Per D3 below (node = lift station), they are **not** added as graph nodes. This is a deliberate scope boundary, not an oversight.

### D3: Node = named lift station, unchanged from Phase 1

Reaffirms the Phase 1 decision (`specs/2026-06-30-data-model/requirements.md` D3). A node is a place a skier can board, alight, or stand at the base/top of a major lift. Villages with no major lift access are not nodes, because the app routes between lift-connected points.

### D4: Lift-by-lift fidelity — no collapsing of multi-segment journeys

Each named lift is modelled as its own pair of nodes (base and summit) connected by a single lift edge. If reaching a destination requires riding two lifts in succession, the route will show each lift as a distinct step. Any skiable piste between two consecutive lifts also appears as a separate slope step.

This replaces the earlier decision to collapse multi-segment lifts into a single edge. The change is driven by the in-mountain use case: a skier following a route in real time needs a step-by-step guide naming every lift they board and every run they ski, not an abstracted station-to-station hop. Lift-by-lift fidelity makes the app genuinely useful on the mountain.

### D5: Sourcing

Data was extracted from official Portes du Soleil sector piste maps (PDF, with embedded text layers for lift/piste names) published at en.portesdusoleil.com, covering: Avoriaz/Morzine/Lindarets/Ardent, Champéry/Les Crosets/Champoussin/Morgins, Châtel/Torgon/La Chapelle d'Abondance, and Morzine/Les Gets. The Châtel and Morzine/Les Gets sector maps both include a master "Tour des Portes du Soleil" overview diagram naming all 13 sub-resorts, their elevations, and the named lift-by-lift circuit — used as the cross-resort connectivity backbone. The Wikipedia "Portes du Soleil" article was used to confirm the canonical list of 13 sub-resorts.

This is a best-effort reconstruction from map sources, not a pixel-traced transcription of every lift line — some edges (e.g. the exact connecting piste name between two stations) are a reasonable inference from adjacent station geography where the map's jumbled text layer didn't yield an unambiguous lift-to-lift pairing. Where genuinely uncertain, the connection was omitted rather than guessed (see D2).

---

## New Nodes

| ID | Name | Country | Lift Type | Connects via |
|---|---|---|---|---|
| `ardent` | Ardent | FR | gondola | TC Ardent (Lindarets ↔ Ardent ↔ Montriond valley) |
| `montriond` | Montriond | FR | chairlift | Ardent base link |
| `saint-jean-daulps` | Saint-Jean-d'Aulps | FR | chairlift | Ranfoilly Express (toward Morzine/Nyon sector) |
| `la-chapelle-dabondance` | La Chapelle d'Abondance | FR | gondola | TC La Panthiaz (toward Pré-la-Joux) |
| `torgon` | Torgon | CH | chairlift | TSF Tronchey (toward La Chapelle d'Abondance) |
| `champoussin` | Champoussin | CH | chairlift | Pointe de l'Au (toward Les Crosets) |

## New Edges (summary)

| From | To | Name | Type | Difficulty | Bidirectional |
|---|---|---|---|---|---|
| `morzine-village` | `saint-jean-daulps` | Nauchets | slope | blue | |
| `saint-jean-daulps` | `morzine-village` | Ranfoilly Express | lift | green | |
| `les-lindarets` | `ardent` | Ardent | lift | green | true |
| `ardent` | `montriond` | Ardent base | lift | green | true |
| `pre-la-joux` | `ardent` | Pré la Joux | slope | blue | |
| `pre-la-joux` | `pointe-de-mossettes` | Portes du Soleil | lift | green | |
| `pointe-de-mossettes` | `pre-la-joux` | Combes | slope | blue | |
| `pre-la-joux` | `la-chapelle-dabondance` | Crêt Béni | slope | blue | |
| `la-chapelle-dabondance` | `pre-la-joux` | La Panthiaz | lift | green | |
| `la-chapelle-dabondance` | `torgon` | Plan de Croix | slope | blue | |
| `torgon` | `la-chapelle-dabondance` | Tronchey | lift | green | |
| `les-crosets` | `champoussin` | Pointe de l'Au | lift | green | true |

This adds a second FR↔CH corridor (`pre-la-joux` ↔ `pointe-de-mossettes`, the real-world Col des Portes du Soleil link) independent of the existing Châtel→Morgins→Crosets route, giving the pathfinder genuine route choices in that area.

---

## Alignment with Parent Specs

- `roadmap.md` Phase 5: "Full data: complete Portes du Soleil network in `network.json`" — this phase delivers that item early.
- `specs/2026-06-30-data-model/requirements.md`: schema is unchanged; this phase only adds nodes/edges within the existing Phase 1 schema (D1–D5 there still apply).
- No changes to `src/`, `index.html`, or `css/` — this is a data-only phase.
