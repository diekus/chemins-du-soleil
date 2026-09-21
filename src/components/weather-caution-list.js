import { FLAGS } from '../countries.js';
import { ICONS, WEATHER_ICONS } from '../icons.js';
import { t } from '../i18n.js';

const CAUTION_ICONS = {
  wind:  ICONS.wind,
  storm: WEATHER_ICONS.thunderstorm,
  fog:   WEATHER_ICONS.fog,
};

const CAUTION_MESSAGE_KEY = {
  wind:  'weather.cautionWind',
  storm: 'weather.cautionStorm',
  fog:   'weather.cautionFog',
};

const SKELETON_ROWS = 2;

class WeatherCautionList extends HTMLElement {
  #cautions = undefined; // undefined=loading, null=unavailable, array=rendered
  #onLocaleChange = () => this.#render();

  /**
   * Assign cautionary weather data:
   *   undefined → loading skeleton
   *   null      → "unavailable" — silently rendered as empty; the caller's
   *               own empty-state message covers this case, same as [].
   *   [...]     → one card per resort with at least one active caution —
   *               [{ slug, name, country, cautions: [{ type }] }],
   *               derived from live weather.deriveCautions(), not an
   *               official weather-service alert.
   */
  set cautions(val) {
    this.#cautions = val;
    this.#render();
  }

  connectedCallback() {
    this.#render();
    window.addEventListener('localechange', this.#onLocaleChange);
  }

  disconnectedCallback() {
    window.removeEventListener('localechange', this.#onLocaleChange);
  }

  #render() {
    const data = this.#cautions;
    if (data === undefined)        { this.innerHTML = this.#loadingHTML(); return; }
    if (!data || data.length === 0) { this.innerHTML = '';                  return; }
    const rows = data.map(r => this.#cardHTML(r)).join('');
    this.innerHTML = `<ul class="caution-list" role="list">${rows}</ul>`;
  }

  #cardHTML(r) {
    const flag = FLAGS[r.country] ?? '';
    const notes = r.cautions.map(c => `
      <li class="caution-note" data-type="${c.type}">
        <span class="caution-icon" aria-hidden="true">${CAUTION_ICONS[c.type] ?? ''}</span>
        <span>${t('caution.prefix', { message: t(CAUTION_MESSAGE_KEY[c.type] ?? '') })}</span>
      </li>
    `).join('');

    return `
      <li class="caution-card">
        <div class="caution-card-top">
          <span class="caution-flag" aria-hidden="true">${flag}</span>
          <span class="caution-name">${r.name}</span>
        </div>
        <ul class="caution-notes" role="list">${notes}</ul>
      </li>
    `;
  }

  #loadingHTML() {
    return `
      <ul class="caution-list" role="status" aria-busy="true" aria-label="${t('caution.loading')}">
        ${Array.from({ length: SKELETON_ROWS }, () => '<li class="caution-card-skeleton"></li>').join('')}
      </ul>
    `;
  }
}

customElements.define('weather-caution-list', WeatherCautionList);
