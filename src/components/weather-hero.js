import { relativeTime } from '../format.js';
import { COUNTRY_NAME } from '../countries.js';
import { ICONS, WEATHER_ICONS } from '../icons.js';
import { animateHeightChange } from '../animate-height.js';
import { weatherConditionKey } from '../weather.js';
import { t } from '../i18n.js';

const RISK_LABEL_KEY = { 1: 'risk.1', 2: 'risk.2', 3: 'risk.3', 4: 'risk.4', 5: 'risk.5' };
const WARNING_LEVEL = 2; // avalanche risk at or above this level surfaces in the collapsed card

class WeatherHero extends HTMLElement {
  #data       = undefined; // undefined=loading, null=unavailable, object=rendered
  #avalanche  = undefined; // undefined=unknown yet, null=no data, object={level,...}
  #inVicinity = undefined; // undefined=unknown yet, true=near the resort, false=not
  #expanded   = false;
  #onLocaleChange = () => this.#render();

  /**
   * Assign weather data:
   *   undefined → loading skeleton
   *   null      → "unavailable" state (no fabricated numbers)
   *   object    → { resortName, country, elevation, live, temp, feelsLike,
   *                 weatherCode, freshSnow, baseDepth, windSpeed, windDirection,
   *                 updatedAt }
   */
  set data(val) {
    this.#data = val;
    this.#render();
  }

  /** Assign avalanche risk data: undefined=unknown, null=none, object={level}. */
  set avalanche(val) {
    this.#avalanche = val;
    this.#render();
  }

  /** Whether the device is currently near this resort: undefined=unknown yet, true/false otherwise. */
  set inVicinity(val) {
    this.#inVicinity = val;
    this.#render();
  }

  connectedCallback() {
    this.#render();
    this.addEventListener('click', e => {
      if (e.target.closest('[data-action="change-resort"]')) {
        this.dispatchEvent(new CustomEvent('change-resort', { bubbles: true }));
      } else if (e.target.closest('[data-action="toggle"]')) {
        animateHeightChange(this, () => {
          this.#expanded = !this.#expanded;
          this.#render();
        });
      }
    });
    window.addEventListener('localechange', this.#onLocaleChange);
  }

  disconnectedCallback() {
    window.removeEventListener('localechange', this.#onLocaleChange);
  }

  #render() {
    const d = this.#data;
    if (d === undefined) { this.innerHTML = this.#loadingHTML();     return; }
    if (d === null)      { this.innerHTML = this.#unavailableHTML(); return; }
    this.innerHTML = this.#expanded ? this.#expandedHTML(d) : this.#collapsedHTML(d);
  }

  #liveStatusLabel(d) {
    return d.live ? t('weather.liveLocation') : t('weather.selectedResort');
  }

  #liveBadgeHTML(d) {
    return `
      <div class="hero-top">
        <button type="button" class="hero-live" data-action="change-resort">
          <span class="hero-live-dot" aria-hidden="true"></span>
          ${this.#liveStatusLabel(d)}
        </button>
      </div>
    `;
  }

  /** Compact one-liner used in the collapsed card. */
  #avalancheLine() {
    const a = this.#avalanche;
    if (!a || a.level < WARNING_LEVEL) return '';
    const label = t(RISK_LABEL_KEY[a.level] ?? 'risk.unknown');
    return `
      <span class="hero-avalanche-line" data-level="${a.level}">
        <span aria-hidden="true">▲</span> ${label}
      </span>
    `;
  }

  /** Compact one-liner used in the collapsed card when the device isn't near this resort. */
  #vicinityNote() {
    if (this.#inVicinity !== false) return '';
    return `<span class="hero-vicinity-note">${t('weather.notNearby')}</span>`;
  }

  /** Fuller sentence used in the expanded card when the device isn't near this resort. */
  #vicinityMessage(d) {
    if (this.#inVicinity !== false) return '';
    return `<p class="hero-vicinity-message">${t('weather.notNearbyMessage', { resort: d.resortName })}</p>`;
  }

  /** Fuller badge used in the expanded card — replaces the separate avalanche-banner. */
  #avalancheBlock() {
    const a = this.#avalanche;
    if (!a || a.level < WARNING_LEVEL) return '';
    const label = t(RISK_LABEL_KEY[a.level] ?? 'risk.unknown');
    return `
      <div class="hero-avalanche-block" data-level="${a.level}">
        <span class="hero-avalanche-icon" aria-hidden="true">▲</span>
        <div>
          <strong>${t('weather.avalancheRiskTitle', { label })}</strong>
          <span>${t('weather.levelOfFive', { level: a.level })}</span>
        </div>
      </div>
    `;
  }

  #collapsedHTML(d) {
    const status = this.#liveStatusLabel(d);
    return `
      <div class="hero-card hero-card--collapsed">
        <button type="button" class="hero-dot-btn" data-action="change-resort"
          aria-label="${t('weather.changeResortAria', { status })}">
          <span class="hero-live-dot" aria-hidden="true"></span>
        </button>
        <button type="button" class="hero-toggle hero-toggle--collapsed" data-action="toggle" aria-expanded="false" aria-label="${t('weather.showMore')}">
          <span class="hero-compact-place">${d.resortName}</span>
          <span class="hero-compact-temp">${Math.round(d.temp)}°C</span>
          <span class="hero-compact-snow"><span class="hero-icon" aria-hidden="true">${ICONS.snow}</span> ${d.freshSnow} cm</span>
          ${this.#vicinityNote()}
          ${this.#avalancheLine()}
          <span class="hero-chevron hero-icon" aria-hidden="true">${ICONS.chevronDown}</span>
        </button>
      </div>
    `;
  }

  #expandedHTML(d) {
    const countryName = COUNTRY_NAME[d.country] ?? '';
    const updated = d.updatedAt ? t('common.updated', { time: relativeTime(d.updatedAt) }) : null;
    const condition = t(weatherConditionKey(d.weatherCode));

    return `
      <div class="hero-card">
        ${this.#liveBadgeHTML(d)}
        <button type="button" class="hero-toggle" data-action="toggle" aria-expanded="true" aria-label="${t('weather.showLess')}">
          <h2 class="hero-place">${d.resortName}${countryName ? `, ${countryName}` : ''}</h2>
          <p class="hero-sub">${t('weather.portesDuSoleil', { elevation: d.elevation })}</p>

          ${this.#vicinityMessage(d)}

          <div class="hero-temp-row">
            <span class="hero-temp">${Math.round(d.temp)}°C</span>
            <div class="hero-feels">
              <strong>${t('weather.feelsLike', { temp: `${Math.round(d.feelsLike)}°C` })}</strong>
              <span>${condition}</span>
            </div>
          </div>

          ${this.#avalancheBlock()}

          <div class="hero-stats">
            <div class="hero-stat">
              <span class="hero-stat-label"><span class="hero-icon" aria-hidden="true">${ICONS.snow}</span> ${t('weather.freshSnow')}</span>
              <span class="hero-stat-value">${d.freshSnow} cm</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-label"><span class="hero-icon" aria-hidden="true">${ICONS.snow}</span> ${t('weather.baseDepth')}</span>
              <span class="hero-stat-value">${d.baseDepth} cm</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-label"><span class="hero-icon" aria-hidden="true">${ICONS.wind}</span> ${t('weather.wind')}</span>
              <span class="hero-stat-value">${d.windSpeed} km/h ${d.windDirection}</span>
            </div>
          </div>

          ${updated ? `<p class="hero-updated">${updated}</p>` : ''}
          <span class="hero-chevron hero-chevron--up hero-icon" aria-hidden="true">${ICONS.chevronDown}</span>
        </button>
      </div>
    `;
  }

  #loadingHTML() {
    return `<div class="hero-card hero-card--loading" role="status" aria-busy="true" aria-label="${t('weather.loadingLabel')}"></div>`;
  }

  #unavailableHTML() {
    return `
      <div class="hero-card hero-card--empty" role="status">
        <p>${t('weather.unavailable')}</p>
      </div>
    `;
  }

}

customElements.define('weather-hero', WeatherHero);
