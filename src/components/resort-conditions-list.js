import { FLAGS } from '../countries.js';

const RISK_LABELS   = { 1: 'Low', 2: 'Moderate', 3: 'Considerable', 4: 'High', 5: 'Very high' };
const SKELETON_ROWS = 6;

class ResortConditionsList extends HTMLElement {
  #resorts = undefined; // undefined=loading, null=unavailable, array=rendered

  /**
   * Assign resort overview data:
   *   undefined → loading skeleton
   *   null      → "unavailable" state
   *   [...]     → [{ slug, name, country, elevation,
   *                  weather: null | { temp, condition, windSpeed, windDirection },
   *                  avalanche: null | { level } }]
   */
  set resorts(val) {
    this.#resorts = val;
    this.#render();
  }

  connectedCallback() {
    this.#render();
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
    if (!w) return `<p class="resort-weather resort-weather--empty">Weather unavailable</p>`;
    return `
      <div class="resort-weather">
        <span class="resort-temp">${Math.round(w.temp)}°C</span>
        <span class="resort-condition">${w.condition}</span>
        <span class="resort-wind">${w.windSpeed} km/h ${w.windDirection}</span>
      </div>
    `;
  }

  #avalancheHTML(a) {
    if (!a) return `<p class="resort-avalanche resort-avalanche--empty">Avalanche data unavailable</p>`;
    const label = RISK_LABELS[a.level] ?? 'Unknown';
    return `
      <p class="resort-avalanche" data-level="${a.level}">
        <span class="resort-ava-dot" aria-hidden="true"></span>
        Avalanche risk: ${label}
      </p>
    `;
  }

  #loadingHTML() {
    return `
      <ul class="resort-list" role="status" aria-busy="true" aria-label="Loading resort conditions…">
        ${Array.from({ length: SKELETON_ROWS }, () => '<li class="resort-card-skeleton"></li>').join('')}
      </ul>
    `;
  }

  #unavailableHTML() {
    return `<p class="resort-list-empty">Resort conditions unavailable right now.</p>`;
  }
}

customElements.define('resort-conditions-list', ResortConditionsList);
