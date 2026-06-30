# Phase 3 — Core UI: Validation

Phase 3 is complete when all of the following checks pass.

---

## 1. App loads without errors

Open `index.html` via a local server. The browser console must show zero errors and zero failed network requests. The form is visible and interactive immediately.

---

## 2. Golden path — Morzine → Champéry at max blue

1. Type "Morzine" in the Start field → autocomplete shows Morzine with 🇫🇷 flag.
2. Select it with keyboard (Enter) or mouse click.
3. Type "Champéry" in the Destination field → autocomplete shows Champéry with 🇨🇭 flag.
4. Select it.
5. Leave difficulty at default (black).
6. Click "Find route".

Expected:
- [ ] 3 route cards appear, stacked vertically
- [ ] First card is labelled "Best route" (cost 6)
- [ ] Each step row shows: icon (🚡 or ⛷️), connection name, country flag, difficulty dot
- [ ] Chavanette (black slope) appears in alternative routes but **not** in Route 1

7. Change difficulty to **blue** and search again.

Expected:
- [ ] 3 cards still appear (3 routes exist at max blue)
- [ ] No step in any card has a black difficulty dot

---

## 3. No-route-found state

Select a start and destination with no path between them (e.g. two nodes that are not connected in the current seed data, or use the `island` node if exposed). Click "Find route".

Expected:
- [ ] "No route found" message is displayed — no route cards
- [ ] Message is visible, not hidden behind other content

---

## 4. Same-start-end error

Select the same station for both Start and Destination. Click "Find route".

Expected:
- [ ] An inline error message appears before the engine is called
- [ ] No route cards are shown for this case

---

## 5. Combobox keyboard navigation

1. Focus the Start input.
2. Type "av" → dropdown opens with matching options.
3. Press Arrow Down twice → second option is highlighted.
4. Press Arrow Up once → first option is highlighted.
5. Press Enter → option is selected, dropdown closes, input shows station name with flag.
6. Focus the Destination input.
7. Type "cha" → dropdown opens.
8. Press Escape → dropdown closes, no selection is made.

Expected: all steps behave as described with no JS errors.

---

## 6. Light mode / dark mode

Toggle system appearance preference (macOS: System Settings → Appearance; DevTools: Rendering → Emulate CSS prefers-color-scheme).

Expected:
- [ ] Light mode: white background, charcoal text, light surfaces per `BRAND_DESIGN.md` tokens
- [ ] Dark mode: `#2E2E2E` background, white text, `#3A3A3A` surfaces — no new hues, strict inversion
- [ ] Slope difficulty dots use the same semantic colours in both modes (with dark-mode values per `BRAND_DESIGN.md`)
- [ ] No manual toggle present in the UI

---

## 7. Responsive layout

- [ ] At 375 px wide (iPhone SE): form and cards fit without horizontal scroll; combobox dropdown does not overflow viewport
- [ ] At 1280 px wide: content is centred with comfortable max-width, not stretched edge-to-edge

---

## 8. Basic accessibility checks

- [ ] All form controls have visible labels
- [ ] Combobox announces its role and expanded state to screen readers (`role="combobox"`, `aria-expanded`, `aria-activedescendant`)
- [ ] Colour alone is not the sole indicator of information (difficulty dots include text labels or `aria-label`)
- [ ] Tab order is logical: Start → Destination → Difficulty → Find route button

---

## 9. Merge criteria

- [ ] Zero console errors on load and after a successful search
- [ ] Golden path (check 2) passes in Chrome and Firefox
- [ ] No-route-found state (check 3) works
- [ ] Keyboard navigation (check 5) works
- [ ] Light/dark mode (check 6) works
- [ ] 375 px viewport (check 7) works without horizontal scroll
- [ ] No PWA files included (`manifest.json`, service worker) — those are Phase 4
- [ ] `README.md` updated with local server instruction
