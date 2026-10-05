import { animateHeightChange } from '../animate-height.js';
import { t } from '../i18n.js';

// Fraction of the panel's width a drag must cover to commit to the next page.
const SWIPE_COMMIT = 0.2;
// Movement (px) before a gesture is classified as a horizontal swipe or a vertical scroll.
const SWIPE_SLOP = 10;

/**
 * Horizontally swipeable pages with a segmented tab switcher above them.
 *
 * Light-DOM children marked `data-swipe-page="<name>"` become the pages;
 * each one's `data-label-key` is the i18n key for its tab. Tabs follow the
 * ARIA tabs pattern (arrow keys / Home / End move between them), so swiping
 * is only ever a shortcut, never the only way to switch.
 *
 * Deliberately not a scroll container: the track is moved with a transform
 * inside an `overflow-x: clip` box, which (unlike overflow: hidden/auto)
 * leaves overflow-y visible — so a <station-input> dropdown on a page can
 * still spill out below the panel.
 *
 * Fires 'swipechange' ({ detail: { page } }) when the user changes page.
 */
class SwipePanel extends HTMLElement {
  #pages    = [];
  #index    = 0;
  #tabsEl   = null;
  #trackEl  = null;
  #drag     = null; // { id, x, y, horizontal: null|bool, dx }
  #onLocaleChange = () => this.#renderTabs();

  connectedCallback() {
    if (this.#trackEl) return; // already built (re-attached)

    this.#pages = [...this.querySelectorAll(':scope > [data-swipe-page]')];
    const uid = this.id || `swipe-${Math.random().toString(36).slice(2, 8)}`;

    this.#tabsEl = document.createElement('div');
    this.#tabsEl.className = 'swipe-tabs';
    this.#tabsEl.setAttribute('role', 'tablist');

    this.#trackEl = document.createElement('div');
    this.#trackEl.className = 'swipe-track';

    this.#pages.forEach((page, i) => {
      page.id ||= `${uid}-page-${i}`;
      page.classList.add('swipe-page');
      page.setAttribute('role', 'tabpanel');
      page.setAttribute('aria-labelledby', `${page.id}-tab`);
      this.#trackEl.appendChild(page);

      const tab = document.createElement('button');
      tab.type = 'button';
      tab.id = `${page.id}-tab`;
      tab.className = 'swipe-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', page.id);
      tab.dataset.index = String(i);
      this.#tabsEl.appendChild(tab);
    });

    const viewport = document.createElement('div');
    viewport.className = 'swipe-viewport';
    viewport.appendChild(this.#trackEl);
    this.append(this.#tabsEl, viewport);

    this.#tabsEl.addEventListener('click', e => {
      const tab = e.target.closest('.swipe-tab');
      if (tab) this.#go(Number(tab.dataset.index), true);
    });
    this.#tabsEl.addEventListener('keydown', e => this.#onTabKey(e));

    this.#trackEl.addEventListener('pointerdown',   e => this.#onPointerDown(e));
    this.#trackEl.addEventListener('pointermove',   e => this.#onPointerMove(e));
    this.#trackEl.addEventListener('pointerup',     e => this.#onPointerEnd(e));
    this.#trackEl.addEventListener('pointercancel', e => this.#onPointerEnd(e, true));

    this.#renderTabs();
    this.#apply();
    window.addEventListener('localechange', this.#onLocaleChange);
  }

  disconnectedCallback() {
    window.removeEventListener('localechange', this.#onLocaleChange);
  }

  /** Name (data-swipe-page value) of the visible page. */
  get page() { return this.#pages[this.#index]?.dataset.swipePage ?? null; }

  /** Switches to the named page without firing 'swipechange'. */
  set page(name) {
    const i = this.#pages.findIndex(p => p.dataset.swipePage === name);
    if (i >= 0 && i !== this.#index) this.#go(i, false);
  }

  #renderTabs() {
    this.#tabsEl.setAttribute('aria-label', t(this.getAttribute('label-key') ?? ''));
    [...this.#tabsEl.children].forEach((tab, i) => {
      tab.textContent = t(this.#pages[i].dataset.labelKey ?? '');
    });
  }

  #go(index, userInitiated) {
    index = Math.max(0, Math.min(this.#pages.length - 1, index));
    if (index === this.#index) { this.#apply(); return; }
    this.#index = index;
    animateHeightChange(this, () => this.#apply());
    if (userInitiated) {
      this.dispatchEvent(new CustomEvent('swipechange', { detail: { page: this.page }, bubbles: true }));
    }
  }

  /** Syncs tabs, track position and which pages are inert to #index. */
  #apply() {
    this.#trackEl.style.setProperty('--swipe-index', String(this.#index));
    this.#trackEl.style.removeProperty('--swipe-drag');
    this.#trackEl.classList.remove('swipe-track--dragging');
    [...this.#tabsEl.children].forEach((tab, i) => {
      const selected = i === this.#index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    this.#pages.forEach((page, i) => {
      const away = i !== this.#index;
      page.inert = away;
      page.classList.toggle('swipe-page--away', away);
    });
  }

  #onTabKey(e) {
    const keys = { ArrowRight: 1, ArrowLeft: -1 };
    let next;
    if (e.key in keys)        next = this.#index + keys[e.key];
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End')  next = this.#pages.length - 1;
    else return;
    e.preventDefault();
    this.#go(next, true);
    this.#tabsEl.children[this.#index]?.focus();
  }

  // ── Swipe gesture ──────────────────────────────────────────────────────────
  // touch-action: pan-y on the track (components.css) leaves vertical scrolling
  // to the browser, so only horizontal-ish moves reach here as a drag.

  #onPointerDown(e) {
    if (e.pointerType === 'mouse' || this.#pages.length < 2) return;
    this.#drag = { id: e.pointerId, x: e.clientX, y: e.clientY, horizontal: null, dx: 0 };
  }

  #onPointerMove(e) {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;

    if (d.horizontal === null) {
      if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return;
      d.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!d.horizontal) { this.#drag = null; return; }
      this.#trackEl.setPointerCapture(e.pointerId);
      // Show every page while dragging so the neighbour slides in, not a blank.
      this.#pages.forEach(p => p.classList.remove('swipe-page--away'));
      this.#trackEl.classList.add('swipe-track--dragging');
    }

    // Resist dragging past the first/last page.
    const atEdge = (this.#index === 0 && dx > 0) || (this.#index === this.#pages.length - 1 && dx < 0);
    d.dx = atEdge ? dx / 3 : dx;
    this.#trackEl.style.setProperty('--swipe-drag', `${d.dx}px`);
  }

  #onPointerEnd(e, cancelled = false) {
    const d = this.#drag;
    if (!d || e.pointerId !== d.id) return;
    this.#drag = null;
    if (!d.horizontal) return;

    const threshold = this.offsetWidth * SWIPE_COMMIT;
    let next = this.#index;
    if (!cancelled && d.dx <= -threshold) next++;
    if (!cancelled && d.dx >=  threshold) next--;
    this.#go(next, true);
  }
}

customElements.define('swipe-panel', SwipePanel);
