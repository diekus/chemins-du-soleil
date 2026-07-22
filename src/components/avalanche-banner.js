const RISK_LABELS = { 1: 'Low', 2: 'Moderate', 3: 'Considerable', 4: 'High', 5: 'Very high' };
const DISMISS_AFTER_MS = 5000;
const FADE_DURATION_MS = 400;

class AvalancheBanner extends HTMLElement {
  #data        = undefined; // undefined=loading, null=unavailable, object=rendered
  #isStatic    = false;     // set via the `static` attribute — no tap-for-detail affordance
  #dismissTimer = null;
  #fadeTimer    = null;

  /**
   * Assign avalanche risk data:
   *   undefined → loading skeleton
   *   null      → "no data available" message, auto-dismissed after 5s
   *   object    → { level (1-5), sector, note, live, updatedAt }
   *               — when `live` is false, `level`/`sector`/`note` come from
   *                 the hand-maintained data/avalanche.json, not a live
   *                 reading. The card shows an "Example data" note (not
   *                 "Estimated" — this isn't inferred from anything, it's a
   *                 fallback placeholder) and auto-dismisses after 5s, same
   *                 as the no-data case.
   */
  set data(val) {
    this.#data = val;
    this.#cancelDismiss();
    this.classList.remove('avalanche-banner--fading');
    this.hidden = false;
    this.#render();
  }

  connectedCallback() {
    this.#isStatic = this.hasAttribute('static');
    this.#render();
    if (!this.#isStatic) {
      this.addEventListener('click', () => this.#notify());
      this.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.#notify(); }
      });
    }
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

  #notify() {
    // Tapping surfaces more detail in the Alerts view — this component has none of its own.
    this.dispatchEvent(new CustomEvent('details', { bubbles: true }));
  }

  #render() {
    const d = this.#data;
    if (this.#isStatic) {
      this.removeAttribute('role');
      this.removeAttribute('tabindex');
    } else {
      this.setAttribute('role', 'button');
      this.setAttribute('tabindex', '0');
    }

    if (d === undefined) { this.innerHTML = this.#loadingHTML();     return; }
    if (d === null)      { this.innerHTML = this.#unavailableHTML(); this.#scheduleDismiss(); return; }
    this.innerHTML = this.#bannerHTML(d);
    // Fallback (not live) data is advisory, not authoritative — surface it
    // briefly then get out of the way, same as the no-data case.
    if (d.live === false) this.#scheduleDismiss();
  }

  #scheduleDismiss() {
    this.#dismissTimer = setTimeout(() => {
      this.classList.add('avalanche-banner--fading');
      this.#fadeTimer = setTimeout(() => { this.hidden = true; }, FADE_DURATION_MS);
    }, DISMISS_AFTER_MS);
  }

  #bannerHTML(d) {
    const label = RISK_LABELS[d.level] ?? 'Unknown';
    const tapHint = this.#isStatic ? '' : ' Tap for more detail.';
    if (!this.#isStatic) {
      this.setAttribute('aria-label', `Avalanche risk: ${label}, level ${d.level} of 5.${tapHint}`);
    }

    const provenance = d.live === false
      ? '<p class="warning-provenance">Example data — live risk level unavailable</p>' : '';
    const updated = d.updatedAt ? `<p class="warning-provenance">Updated ${this.#relativeTime(d.updatedAt)}</p>` : '';
    const chevron = this.#isStatic ? '' : '<span class="warning-chevron" aria-hidden="true">›</span>';

    return `
      <div class="warning-banner">
        <span class="warning-icon-badge" aria-hidden="true">▲</span>
        <div class="warning-body">
          <strong>Avalanche risk: ${label}</strong>
          <p>Level ${d.level} of 5${d.sector ? ` · ${d.sector} sector` : ''}${d.note ? ` · ${d.note}` : ''}</p>
          ${provenance}
          ${updated}
        </div>
        ${chevron}
      </div>
    `;
  }

  #relativeTime(timestamp) {
    const mins = Math.round((Date.now() - timestamp) / 60000);
    if (mins < 1)   return 'just now';
    if (mins === 1) return '1 minute ago';
    if (mins < 60)  return `${mins} minutes ago`;
    const hours = Math.round(mins / 60);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  #loadingHTML() {
    this.removeAttribute('aria-label');
    return `<div class="warning-banner warning-banner--loading" role="status" aria-busy="true" aria-label="Loading avalanche risk…"></div>`;
  }

  #unavailableHTML() {
    if (!this.#isStatic) {
      this.setAttribute('aria-label', 'No avalanche data available. Tap for more detail.');
    }
    const chevron = this.#isStatic ? '' : '<span class="warning-chevron" aria-hidden="true">›</span>';
    return `
      <div class="warning-banner warning-banner--empty" role="status">
        <span class="warning-icon-badge" aria-hidden="true">▲</span>
        <div class="warning-body">
          <strong>No avalanche data available</strong>
        </div>
        ${chevron}
      </div>
    `;
  }
}

customElements.define('avalanche-banner', AvalancheBanner);
