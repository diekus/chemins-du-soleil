# Phase 4 — PWA Shell: Plan

Each task group is independently verifiable before moving to the next.

---

## 1. Icon assets

Generate all required icon sizes from the canonical source (`images/icon.png`,
512×512 RGBA PNG).

- [ ] 1.1 — Resize to `images/icon-192.png` (192×192, standard).
- [ ] 1.2 — Confirm `images/icon.png` is used as-is for 512×512 standard.
- [ ] 1.3 — Generate `images/icon-maskable.png` (512×512 with ~10% safe-zone
      padding on a solid background colour matching the brand palette).

**Verify**: All three files exist, open correctly in an image viewer, and meet
the pixel dimensions.

---

## 2. Web App Manifest

Create `manifest.json` at the repo root.

- [ ] 2.1 — Add required fields: `name`, `short_name`, `start_url`, `display`,
      `theme_color`, `background_color`.
- [ ] 2.2 — Set `display` to `window-controls-overlay` (primary) with
      `display_override: ["window-controls-overlay", "standalone"]` for
      progressive enhancement fallback.
- [ ] 2.3 — Add `icons` array: 192×192 standard, 512×512 standard, 512×512
      maskable (purpose: `"maskable"`).
- [ ] 2.4 — Link manifest in `index.html`:
      `<link rel="manifest" href="/manifest.json">`.
- [ ] 2.5 — Add `<meta name="theme-color">` to `index.html` aligned with
      `theme_color` in the manifest.

**Verify**: Chrome DevTools → Application → Manifest shows all fields with no
warnings.

---

## 3. Offline fallback page

Create a minimal `offline.html` to be served when a network request fails and
the resource is not cached.

- [ ] 3.1 — Create `offline.html`: brief message, app name, no external
      dependencies.
- [ ] 3.2 — Apply `prefers-color-scheme` dark/light styles inline (no external
      CSS file dependency to avoid a cache miss on the fallback itself).
- [ ] 3.3 — Ensure the page is WCAG 2.1 AA compliant (sufficient contrast,
      proper heading structure).

**Verify**: Load `offline.html` directly in a browser — readable in both
light and dark mode, no broken resource requests.

---

## 4. Service Worker

Create `sw.js` at the repo root.

- [ ] 4.1 — Define the precache list: all app shell files (`index.html`,
      `manifest.json`, CSS, JS modules, `offline.html`) and
      `data/network.json`.
- [ ] 4.2 — `install` event: cache all precache list items, call
      `skipWaiting()`.
- [ ] 4.3 — `activate` event: delete old caches by version key, call
      `clients.claim()`.
- [ ] 4.4 — `fetch` event: cache-first strategy — return cached response if
      available, otherwise fetch from network and cache the response. On
      network failure for a navigation request, serve `offline.html`.
- [ ] 4.5 — Register `sw.js` in `index.html` (inside a `navigator.serviceWorker`
      feature-detect guard).

**Verify**: DevTools → Application → Service Workers shows SW as active. Network
tab set to Offline — app still loads and route-finding works.

---

## 5. Window Controls Overlay

Implement WCO titlebar area as a progressive enhancement.

- [ ] 5.1 — Add CSS custom properties for the WCO safe-area insets
      (`env(titlebar-area-x)`, `env(titlebar-area-y)`,
      `env(titlebar-area-width)`, `env(titlebar-area-height)`).
- [ ] 5.2 — Use `window.matchMedia` or `navigator.windowControlsOverlay` API
      to detect WCO support and apply layout adjustments only when active.
- [ ] 5.3 — Confirm the app header/brand area renders correctly in the WCO
      draggable region without obscuring interactive controls.
- [ ] 5.4 — Confirm fallback (non-WCO context) layout is unaffected.

**Verify**: Install the app in Chromium desktop and confirm the title bar shows
the app name in the overlay region. Open in Firefox or mobile — layout is
normal.

---

## 6. Lighthouse audit

Run and pass the Lighthouse PWA audit.

- [ ] 6.1 — Open the installed app (or `http://localhost` / file server) in
      Chrome.
- [ ] 6.2 — Run Lighthouse → PWA category.
- [ ] 6.3 — All PWA audit items must be green (no failures, no "not applicable"
      items that should be passing).
- [ ] 6.4 — Fix any issues surfaced and re-run until fully green.

**Verify**: Lighthouse report screenshot with 100% PWA score (or all checks
green — Lighthouse no longer shows a single PWA score in newer versions, so
zero red items is the bar).
