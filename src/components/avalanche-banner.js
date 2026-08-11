import { relativeTime } from '../format.js';

const RISK_LABELS = { 1: 'Low', 2: 'Moderate', 3: 'Considerable', 4: 'High', 5: 'Very high' };
const DISMISS_AFTER_MS = 5000;
const FADE_DURATION_MS = 400;

class AvalancheBanner extends HTMLElement {
  #data         = undefined; // undefined=loading, null=unavailable, object=rendered
  #dismissTimer = null;
  #fadeTimer    = null;

  /**
   * Assign avalanche risk data:
   *   undefined → loading skeleton
   *   null      → "no data available" message, auto-dismissed after 5s
   *   object    → { level (1-5), updatedAt } — always a live open-piste reading
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
    this.innerHTML = this.#bannerHTML(d);
  }

  #scheduleDismiss() {
    this.#dismissTimer = setTimeout(() => {
      this.classList.add('avalanche-banner--fading');
      this.#fadeTimer = setTimeout(() => { this.hidden = true; }, FADE_DURATION_MS);
    }, DISMISS_AFTER_MS);
  }

  #bannerHTML(d) {
    const label = RISK_LABELS[d.level] ?? 'Unknown';
    const updated = d.updatedAt ? `<p class="warning-provenance">Updated ${relativeTime(d.updatedAt)}</p>` : '';

    return `
      <div class="warning-banner" data-level="${d.level}">
        <span class="warning-icon-badge" aria-hidden="true">▲</span>
        <div class="warning-body">
          <strong>Avalanche risk: ${label}</strong>
          <p>Level ${d.level} of 5</p>
          ${updated}
        </div>
      </div>
    `;
  }

  #loadingHTML() {
    return `<div class="warning-banner warning-banner--loading" role="status" aria-busy="true" aria-label="Loading avalanche risk…"></div>`;
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
