import { relativeTime } from '../format.js';
import { FLAGS } from '../countries.js';

const RISK_LABELS = { 1: 'Low', 2: 'Moderate', 3: 'Considerable', 4: 'High', 5: 'Very high' };
const DISMISS_AFTER_MS = 5000;
const FADE_DURATION_MS = 400;
const SKELETON_ROWS = 2;

class AvalancheBanner extends HTMLElement {
  #data         = undefined; // undefined=loading, null=unavailable, array=rendered
  #dismissTimer = null;
  #fadeTimer    = null;

  /**
   * Assign avalanche risk data:
   *   undefined → loading skeleton
   *   null      → "no data available" message, auto-dismissed after 5s
   *   [...]     → one banner row per resort at/above the alert threshold —
   *               [{ slug, name, country, level (1-5), updatedAt }], always
   *               live open-piste readings. An empty array renders nothing
   *               (the caller shows its own "no active alerts" message).
   */
  set data(val) {
    this.#data = val;
    this.#cancelDismiss();
    this.classList.remove('avalanche-banner--fading');
    this.hidden = false;
    this.#render();
  }

  connectedCallback() {
    this.#render();
  }

  disconnectedCallback() {
    this.#cancelDismiss();
  }

  #cancelDismiss() {
    clearTimeout(this.#dismissTimer);
    clearTimeout(this.#fadeTimer);
    this.#dismissTimer = null;
    this.#fadeTimer     = null;
  }

  #render() {
    const d = this.#data;
    if (d === undefined) { this.innerHTML = this.#loadingHTML();     return; }
    if (d === null)      { this.innerHTML = this.#unavailableHTML(); this.#scheduleDismiss(); return; }
    if (d.length === 0)  { this.innerHTML = '';                      return; }
    const rows = d.map(r => this.#bannerHTML(r)).join('');
    this.innerHTML = `<ul class="alert-list" role="list">${rows}</ul>`;
  }

  #scheduleDismiss() {
    this.#dismissTimer = setTimeout(() => {
      this.classList.add('avalanche-banner--fading');
      this.#fadeTimer = setTimeout(() => { this.hidden = true; }, FADE_DURATION_MS);
    }, DISMISS_AFTER_MS);
  }

  #bannerHTML(r) {
    const label   = RISK_LABELS[r.level] ?? 'Unknown';
    const flag    = FLAGS[r.country] ?? '';
    const updated = r.updatedAt ? `<p class="warning-provenance">Updated ${relativeTime(r.updatedAt)}</p>` : '';

    return `
      <li class="warning-banner" data-level="${r.level}">
        <span class="warning-icon-badge" aria-hidden="true">▲</span>
        <div class="warning-body">
          <strong>${flag} ${r.name}</strong>
          <p>Avalanche risk: ${label} — level ${r.level} of 5</p>
          ${updated}
        </div>
      </li>
    `;
  }

  #loadingHTML() {
    return `
      <ul class="alert-list" role="status" aria-busy="true" aria-label="Loading avalanche alerts…">
        ${Array.from({ length: SKELETON_ROWS }, () => '<li class="warning-banner warning-banner--loading"></li>').join('')}
      </ul>
    `;
  }

  #unavailableHTML() {
    return `
      <div class="warning-banner warning-banner--empty" role="status">
        <span class="warning-icon-badge" aria-hidden="true">▲</span>
        <div class="warning-body">
          <strong>No avalanche data available</strong>
        </div>
      </div>
    `;
  }
}

customElements.define('avalanche-banner', AvalancheBanner);
