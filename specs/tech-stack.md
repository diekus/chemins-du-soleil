# Tech Stack

## Platform: Progressive Web App

Chemins du Soleil is a **PWA built exclusively on web standards** — no framework, no build step required to run. The goal is maximum reach: any modern browser on any device can run it, and it can be installed as a native-feeling app via the browser install prompt.

Reference: [`prompts/pwa.md`](../prompts/pwa.md)

### Non-negotiables

- Vanilla JavaScript, HTML, and CSS — no React, Vue, Angular, or any JS framework.
- Reusable UI elements are implemented as **Web Components** (`customElements.define`).
- Fully accessible: complies with **WCAG 2.1 AA**. Every image has `alt`. Colours meet contrast ratios.
- Responsive: optimised for mobile (primary use case, on-mountain) and desktop.
- Light/dark mode via `prefers-color-scheme` — no manual toggle, system preference only.
- `window-controls-overlay` display mode implemented, with graceful fallback to standard layout.

### PWA Requirements

| Requirement | Implementation |
|---|---|
| Web App Manifest | `manifest.json` with `name`, `short_name`, icons, `display`, `theme_color`, `background_color` |
| Service Worker | Registers on load; caches app shell and data on install |
| Offline fallback | Custom offline/404 page served from cache when network unavailable |
| Installability | Meets all PWA installability criteria |

### Advanced Web Capabilities (FUGU)

The following capabilities are relevant to this app and will be implemented with graceful degradation where not supported:

- **Shortcuts**: Quick-launch shortcuts in the manifest for common actions (e.g. "Plan a route").
- **Web Share API**: Share a found route with another person.
- **Geolocation** _(roadmap Phase 5)_: Detect the user's nearest lift automatically.

### Offline / Caching Strategy

The **basic offline functionality** is the full route-finding experience: the app shell, the lift/slope data JSON, and the pathfinding engine all cache on first install. A user who has opened the app once can plan routes without any network connection. The offline page is shown only for uncached resources.

---

## Core Algorithm: Dijkstra on a Weighted Graph

The resort network is modelled as a **directed weighted graph**:

- **Nodes**: Each lift station / named location is a node.
- **Edges**: Each slope or connection between two nodes is a directed edge.
- **Weights**: Slope difficulty determines edge weight. The weighting scheme makes easier routes preferred where equivalent:
  - Green = 1
  - Blue = 2
  - Red = 3
  - Black = 4

When a maximum difficulty is set, edges with a weight above the threshold are excluded from the graph before running the algorithm. If no path exists in the reduced graph, the app reports this explicitly.

**Algorithm**: Dijkstra's shortest path. This gives the lowest-cost (least-difficult) route, not just any route.

---

## Data

Lift and slope data is stored in a **single JSON file** (`data/network.json`). This keeps updates simple: a maintainer edits one file each season.

### Node schema (lift/station)

```json
{
  "id": "avoriaz-main",
  "name": "Avoriaz",
  "country": "FR",
  "lift_type": "telecabin",
  "connections": [
    {
      "to": "les-lindarets",
      "name": "Lindarets",
      "type": "lift",
      "difficulty": "green",
      "bidirectional": false
    },
    {
      "to": "les-crosets",
      "name": "Chavanette",
      "type": "slope",
      "difficulty": "black"
    }
  ]
}
```

**Node fields**

| Field | Type | Values |
|---|---|---|
| `id` | string | kebab-case, unique across the file |
| `name` | string | Human-readable display name |
| `country` | string | `FR` or `CH` |
| `lift_type` | string \| null | `chairlift`, `gondola`, `telecabin`, `surface`, or `null` for nodes accessed only by slope |

**Connection fields**

| Field | Type | Values | Required |
|---|---|---|---|
| `to` | string | Must match an existing node `id` | yes |
| `name` | string | Name of the lift or slope segment | yes |
| `type` | string | `lift` or `slope` | yes |
| `difficulty` | string | `green`, `blue`, `red`, `black` | yes |
| `bidirectional` | boolean | `true` for two-way lifts and traverses; default `false` | no |

`bidirectional: true` means the edge is traversable in both directions. The pathfinding engine treats it as two directed edges when building the adjacency list. Every `bidirectional: true` edge must have a matching reverse edge in the destination node (enforced by the validator).

---

## Visual Design & Branding

Reference: [`prompts/BRAND_DESIGN.md`](../prompts/BRAND_DESIGN.md)

- **Aesthetic**: Clean and light. Alpine clarity — white space, crisp typography.
- **Palette (light mode)**: Whites, light blues, and cool neutrals. Slope colour indicators use their real-world colours (green, blue, red, black) as semantic UI elements.
- **Dark mode**: Full dark mode support via `prefers-color-scheme: dark`. Automatic, no toggle.
- **Country indicators**: Emoji flags (🇫🇷 🇨🇭) on lift/station names throughout the UI.
- **Animations & interactions**: Polished and purposeful. Transitions should feel light and fast — appropriate for a tool used in the cold.

> Note: [`prompts/BRAND_DESIGN.md`](../prompts/BRAND_DESIGN.md) is currently a partial draft. The description and visuals sections are incomplete. Expand them before implementing the visual layer.

---

## Testing

- WCAG 2.1 AA compliance verified via automated tooling (e.g. axe-core).
- CSS colour contrast tested at build time where possible.
- Pathfinding algorithm covered by unit tests (vanilla JS test runner or plain `assert`).
- Manual testing on mobile (iOS Safari, Android Chrome) and desktop before each phase is marked complete.
