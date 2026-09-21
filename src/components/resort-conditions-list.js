import { FLAGS } from '../countries.js';
import { WEATHER_ICONS } from '../icons.js';
import { weatherConditionKey, weatherIconKey } from '../weather.js';
import { t } from '../i18n.js';

const RISK_LABEL_KEY = { 1: 'risk.1', 2: 'risk.2', 3: 'risk.3', 4: 'risk.4', 5: 'risk.5' };
const SKELETON_ROWS = 6;

class ResortConditionsList extends HTMLElement {
  #resorts = undefined; // undefined=loading, null=unavailable, array=rendered
  #onLocaleChange = () => this.#render();

  /**
   * Assign resort overview data:
   *   undefined → loading skeleton
   *   null      → "unavailable" state
   *   [...]     → [{ slug, name, country, elevation,
   *                  weather: null | { temp, weatherCode, isDay, windSpeed, windDirection },
   *                  avalanche: null | { level } }]
   */
  set resorts(val) {
    this.#resorts = val;
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
    const resorts = this.#resorts;
    if (resorts === undefined) { this.innerHTML = this.#loadingHTML();     return; }
    if (resorts === null)      { this.innerHTML = this.#unavailableHTML(); return; }
    const rows = resorts.map(r => this.#cardHTML(r)).join('');
    this.innerHTML = `<ul class="resort-list" role="list">${rows}</ul>`;
  }

  #cardHTML(r) {
    const flag = FLAGS[r.country] ?? '';
    return `
      <li class="resort-card">
        <div class="resort-card-top">
          <span class="resort-flag" aria-hidden="true">${flag}</span>
          <span class="resort-name">${r.name}</span>
          <span class="resort-elevation">${r.elevation} m</span>
        </div>
        ${this.#weatherHTML(r.weather)}
        ${this.#avalancheHTML(r.avalanche)}
      </li>
    `;
  }

  #weatherHTML(w) {
    if (!w) return `<p class="resort-weather resort-weather--empty">${t('resorts.weatherUnavailable')}</p>`;
    const icon = WEATHER_ICONS[weatherIconKey(w.weatherCode, w.isDay)];
    const condition = t(weatherConditionKey(w.weatherCode));
    return `
      <div class="resort-weather">
        <span class="resort-weather-icon" aria-hidden="true">${icon}</span>
        <span class="resort-temp">${Math.round(w.temp)}°C</span>
        <span class="resort-condition">${condition}</span>
        <span class="resort-wind">${w.windSpeed} km/h ${w.windDirection}</span>
      </div>
    `;
  }

  #avalancheHTML(a) {
    if (!a) return `<p class="resort-avalanche resort-avalanche--empty">${t('resorts.avalancheUnavailable')}</p>`;
    const label = t(RISK_LABEL_KEY[a.level] ?? 'risk.unknown');
    return `
      <p class="resort-avalanche" data-level="${a.level}">
        <span class="resort-ava-dot" aria-hidden="true"></span>
        ${t('resorts.avalancheRisk', { label })}
      </p>
    `;
  }

  #loadingHTML() {
    return `
      <ul class="resort-list" role="status" aria-busy="true" aria-label="${t('resorts.loading')}">
        ${Array.from({ length: SKELETON_ROWS }, () => '<li class="resort-card-skeleton"></li>').join('')}
      </ul>
    `;
  }

  #unavailableHTML() {
    return `<p class="resort-list-empty">${t('resorts.unavailable')}</p>`;
  }
}

customElements.define('resort-conditions-list', ResortConditionsList);
