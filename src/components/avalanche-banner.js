import { relativeTime } from '../format.js';
import { FLAGS } from '../countries.js';
import { t } from '../i18n.js';

const RISK_LABEL_KEY = { 1: 'risk.1', 2: 'risk.2', 3: 'risk.3', 4: 'risk.4', 5: 'risk.5' };
const DISMISS_AFTER_MS = 5000;
const FADE_DURATION_MS = 400;
const SKELETON_ROWS = 2;

class AvalancheBanner extends HTMLElement {
  #data         = undefined; // undefined=loading, null=unavailable, array=rendered
  #dismissTimer = null;
  #fadeTimer    = null;
  #onLocaleChange = () => this.#render();

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
    window.addEventListener('localechange', this.#onLocaleChange);
  }

  disconnectedCallback() {
    this.#cancelDismiss();
    window.removeEventListener('localechange', this.#onLocaleChange);
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
    const label   = t(RISK_LABEL_KEY[r.level] ?? 'risk.unknown');
    const flag    = FLAGS[r.country] ?? '';
    const updated = r.updatedAt ? `<p class="warning-provenance">${t('common.updated', { time: relativeTime(r.updatedAt) })}</p>` : '';

    return `
      <li class="warning-banner" data-level="${r.level}">
        <span class="warning-icon-badge" aria-hidden="true">▲</span>
        <div class="warning-body">
          <strong>${flag} ${r.name}</strong>
          <p>${t('alerts.avalancheLine', { label, level: r.level })}</p>
          ${updated}
        </div>
      </li>
    `;
  }

  #loadingHTML() {
    return `
      <ul class="alert-list" role="status" aria-busy="true" aria-label="${t('alerts.loading')}">
        ${Array.from({ length: SKELETON_ROWS }, () => '<li class="warning-banner warning-banner--loading"></li>').join('')}
      </ul>
    `;
  }

  #unavailableHTML() {
    return `
      <div class="warning-banner warning-banner--empty" role="status">
        <span class="warning-icon-badge" aria-hidden="true">▲</span>
        <div class="warning-body">
          <strong>${t('alerts.noData')}</strong>
        </div>
      </div>
    `;
  }
}

customElements.define('avalanche-banner', AvalancheBanner);
