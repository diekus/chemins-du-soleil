const COUNTRY_NAME = { FR: 'France', CH: 'Switzerland' };

class WeatherHero extends HTMLElement {
  #data = undefined; // undefined=loading, null=unavailable, object=rendered

  /**
   * Assign weather data:
   *   undefined → loading skeleton
   *   null      → "unavailable" state (no fabricated numbers)
   *   object    → { resortName, country, elevation, live, temp, feelsLike,
   *                 condition, freshSnow, baseDepth, windSpeed, windDirection,
   *                 updatedAt }
   */
  set data(val) {
    this.#data = val;
    this.#render();
  }

  connectedCallback() {
    this.#render();
    this.addEventListener('click', e => {
      if (e.target.closest('[data-action="change-resort"]')) {
        this.dispatchEvent(new CustomEvent('change-resort', { bubbles: true }));
      }
    });
  }

  #render() {
    const d = this.#data;
    if (d === undefined) { this.innerHTML = this.#loadingHTML();     return; }
    if (d === null)      { this.innerHTML = this.#unavailableHTML(); return; }
    this.innerHTML = this.#cardHTML(d);
  }

  #cardHTML(d) {
    const countryName = COUNTRY_NAME[d.country] ?? '';
    const updated = d.updatedAt ? this.#relativeTime(d.updatedAt) : null;

    return `
      <div class="hero-card">
        <div class="hero-top">
          <button type="button" class="hero-live" data-action="change-resort">
            <span class="hero-live-dot" aria-hidden="true"></span>
            ${d.live ? 'Live location' : 'Selected resort'}
          </button>
        </div>
        <h2 class="hero-place">${d.resortName}${countryName ? `, ${countryName}` : ''}</h2>
        <p class="hero-sub">Portes du Soleil · ${d.elevation} m</p>

        <div class="hero-temp-row">
          <span class="hero-temp">${Math.round(d.temp)}°C</span>
          <div class="hero-feels">
            <strong>Feels like ${Math.round(d.feelsLike)}°C</strong>
            <span>${d.condition}</span>
          </div>
        </div>

        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-label">Fresh snow</span>
            <span class="hero-stat-value">${d.freshSnow} cm</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-label">Base depth</span>
            <span class="hero-stat-value">${d.baseDepth} cm</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-label">Wind</span>
            <span class="hero-stat-value">${d.windSpeed} km/h ${d.windDirection}</span>
          </div>
        </div>

        ${updated ? `<p class="hero-updated">Updated ${updated}</p>` : ''}
      </div>
    `;
  }

  #loadingHTML() {
    return `<div class="hero-card hero-card--loading" role="status" aria-busy="true" aria-label="Loading conditions…"></div>`;
  }

  #unavailableHTML() {
    return `
      <div class="hero-card hero-card--empty" role="status">
        <p>Conditions unavailable right now.</p>
      </div>
    `;
  }

  #relativeTime(timestamp) {
    const mins = Math.round((Date.now() - timestamp) / 60000);
    if (mins < 1)  return 'just now';
    if (mins === 1) return '1 minute ago';
    if (mins < 60) return `${mins} minutes ago`;
    const hours = Math.round(mins / 60);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
}

customElements.define('weather-hero', WeatherHero);
