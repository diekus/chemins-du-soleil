# Phase 4 — PWA Shell: Validation

All checks must pass before this branch is merged to `main`.

---

## 1. Installability

- [ ] Chrome (desktop) shows the install prompt (address bar install icon or
      browser menu "Install Chemins du Soleil").
- [ ] Installing the app creates a standalone window (no browser chrome).
- [ ] `window-controls-overlay` is active in the installed Chromium window:
      the app name/logo appears in the OS titlebar area.
- [ ] Safari on iOS shows "Add to Home Screen" and the installed icon matches
      the maskable icon (no white border clipping).

## 2. Offline capability

- [ ] Open the app once with network available (primes the cache).
- [ ] Set DevTools → Network to **Offline** (or disable Wi-Fi/data).
- [ ] Reload — the app shell loads from cache without any network requests.
- [ ] Enter a start and destination, tap "Find route" — pathfinding completes
      using cached `network.json` data.
- [ ] Navigate to a URL that was never cached — `offline.html` is served
      instead of the browser's default offline page.

## 3. Manifest correctness

- [ ] DevTools → Application → Manifest shows:
  - No warnings or errors.
  - `name`, `short_name`, `start_url`, `display`, `theme_color`,
    `background_color`, and three icons all present.
  - Icons load (no broken image placeholders).
  - Maskable icon shows safe-zone preview without clipping critical content.

## 4. Service Worker

- [ ] DevTools → Application → Service Workers shows the SW status as
      **activated and running**.
- [ ] After a hard reload, the SW intercepts requests (visible in the Network
      tab as "(ServiceWorker)" or "(disk cache)").
- [ ] A second SW install (simulated by bumping the cache version string) goes
      through the activate lifecycle cleanly — old cache is deleted.

## 5. Lighthouse PWA audit

- [ ] Run Lighthouse in Chrome against the served app.
- [ ] **Zero red (failing) PWA audit items.**
- [ ] Screenshot of the passing Lighthouse report is saved to
      `specs/2026-07-01-pwa-shell/lighthouse-pass.png` (or equivalent).

## 6. Regression checks

- [ ] Route-finding still works end-to-end (start → destination → result).
- [ ] Light and dark mode render correctly.
- [ ] No console errors on initial load or after a SW-served reload.
- [ ] Existing unit tests (`src/graph.test.js`, `src/pathfinder.test.js`) still
      pass.

---

## Merge gate summary

| Gate | Must pass |
|---|---|
| Browser install prompt appears | Yes |
| App works fully offline | Yes |
| Lighthouse PWA — zero red items | Yes |
| WCO active in Chromium desktop | No (enhancement — log as known if absent) |
| Existing tests pass | Yes |
