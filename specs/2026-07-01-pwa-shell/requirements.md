# Phase 4 — PWA Shell: Requirements

## Objective

Make Chemins du Soleil installable and fully offline-capable. This directly
fulfils Mission goals #4 (offline-capable) and #5 (installable) and completes
the PWA Requirements table in `tech-stack.md`.

The app must be installable via the browser install prompt and must work
completely without a network connection once it has been opened at least once.

---

## Scope

### In scope

- `manifest.json` — Web App Manifest with all required fields.
- Service Worker — cache-first strategy covering the app shell and
  `data/network.json`.
- Offline fallback page — a minimal cached page served when a requested
  resource is not in the cache and the network is unavailable.
- Icon assets — generate the required sizes from `images/icon.png` (512×512
  RGBA PNG source). Required outputs: 192×192 standard, 512×512 standard,
  512×512 maskable (with safe-zone padding).
- `window-controls-overlay` display mode — implemented as a **progressive
  enhancement** with graceful fallback to standard titlebar layout. Not a
  merge blocker.
- Service Worker registration in `index.html`.
- `theme-color` meta tag in `index.html` (aligned with manifest `theme_color`).

### Out of scope

- Push notifications.
- Background sync.
- Periodic background sync.
- App shortcuts (deferred to Phase 5 per roadmap).
- Web Share API (deferred to Phase 5 per roadmap).

---

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Cache-first for all app shell assets and `network.json` | The data changes only at deploy time; stale-while-revalidate is unnecessary complexity. Cache is busted on new Service Worker install. |
| 2 | Single `sw.js` at root | Scope must cover `/` to intercept all app requests. Placing the SW anywhere else would require a `Service-Worker-Allowed` header. |
| 3 | Offline fallback is a separate `offline.html` | Keeps the SW fetch handler simple: return cached asset → fall back to `offline.html`. No runtime templating required. |
| 4 | Icon generation via `sips` (macOS) or `sharp` (CI) | `images/icon.png` at 512×512 is the canonical source. Resize to 192×192. Maskable variant adds ~10% safe-zone padding on a filled background. |
| 5 | `display: window-controls-overlay` with `standalone` fallback in manifest | Per `tech-stack.md`. WCO is only applied in Chromium desktop; other contexts fall back to `standalone`. |
| 6 | Lighthouse "All PWA checks green" is the merge gate | Matches the roadmap Phase 4 output criterion. Covers installability, service worker, and offline. |

---

## Constraints

- Vanilla JS, HTML, CSS only — no build step, no framework (per `tech-stack.md`).
- SW must not cache third-party resources (there are none, but the precache
  list must be explicit to avoid surprises).
- The offline page must be accessible (WCAG 2.1 AA) and respect
  `prefers-color-scheme`.
- All manifest icon paths must resolve correctly when `index.html` is served
  from the repo root.

---

## Alignment with parent specs

| Spec | Relevant section | How Phase 4 satisfies it |
|---|---|---|
| `mission.md` | Goal #4 — Offline-capable | SW caches full app shell + data; route-finding works with zero network. |
| `mission.md` | Goal #5 — Installable | `manifest.json` + SW registration meets all browser installability criteria. |
| `tech-stack.md` | PWA Requirements table | Implements every row: manifest, SW, offline fallback, installability. |
| `tech-stack.md` | Advanced Web Capabilities — Shortcuts | Deferred to Phase 5. |
| `tech-stack.md` | WCO display mode | Implemented as progressive enhancement with fallback. |
| `roadmap.md` | Phase 4 output | "Installable PWA scoring green on Lighthouse PWA audit." |
