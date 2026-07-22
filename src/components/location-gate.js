const PLAUSIBLE_KM = 30; // beyond this, a resolved position isn't confidently "on the mountain"

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

class LocationGate extends HTMLElement {
  #resorts = [];
  #state   = 'prompt'; // 'prompt' | 'locating' | 'picker'

  /** Array of { slug, name, country, elevation, lat, lon } from data/resorts.json. */
  set resorts(list) {
    this.#resorts = list ?? [];
    this.#render();
  }

  connectedCallback() {
    this.#render();
  }

  /** Reset to the initial prompt — used when the user wants to change resort. */
  reopen() {
    this.#state = 'prompt';
    this.hidden = false;
    this.#render();
  }

  #render() {
    if (this.#state === 'prompt')   { this.innerHTML = this.#promptHTML();   this.#bindPrompt();  return; }
    if (this.#state === 'locating') { this.innerHTML = this.#locatingHTML(); return; }
    this.innerHTML = this.#pickerHTML();
    this.#bindPicker();
  }

  #promptHTML() {
    return `
      <div class="location-gate-card">
        <p class="location-gate-text">Show conditions for the resort nearest you?</p>
        <div class="location-gate-actions">
          <button type="button" class="btn-find" data-action="locate">Use my location</button>
          <button type="button" class="btn-text" data-action="pick">Choose a resort</button>
        </div>
      </div>
    `;
  }

  #locatingHTML() {
    return `
      <div class="location-gate-card" aria-busy="true">
        <p class="location-gate-text">Finding your resort…</p>
      </div>
    `;
  }

  #pickerHTML() {
    const options = this.#resorts.map(r => `
      <li><button type="button" class="location-gate-option" data-slug="${r.slug}">${r.name}</button></li>
    `).join('');
    return `
      <div class="location-gate-card">
        <p class="location-gate-text">Choose your resort</p>
        <ul class="location-gate-list">${options}</ul>
      </div>
    `;
  }

  #bindPrompt() {
    this.querySelector('[data-action="locate"]').addEventListener('click', () => this.#locate());
    this.querySelector('[data-action="pick"]').addEventListener('click', () => {
      this.#state = 'picker';
      this.#render();
    });
  }

  #bindPicker() {
    this.querySelectorAll('.location-gate-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const resort = this.#resorts.find(r => r.slug === btn.dataset.slug);
        if (resort) this.#resolve(resort, false);
      });
    });
  }

  #locate() {
    if (!('geolocation' in navigator)) {
      this.#state = 'picker';
      this.#render();
      return;
    }
    this.#state = 'locating';
    this.#render();
    navigator.geolocation.getCurrentPosition(
      pos => this.#onPosition(pos),
      () => { this.#state = 'picker'; this.#render(); },
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  #onPosition(pos) {
    const { latitude, longitude } = pos.coords;
    let nearest = null;
    let nearestKm = Infinity;
    for (const r of this.#resorts) {
      const km = haversineKm(latitude, longitude, r.lat, r.lon);
      if (km < nearestKm) { nearest = r; nearestKm = km; }
    }
    if (nearest && nearestKm <= PLAUSIBLE_KM) {
      this.#resolve(nearest, true);
    } else {
      // Too far from every known resort to be a confident match — ask instead of guessing.
      this.#state = 'picker';
      this.#render();
    }
  }

  #resolve(resort, live) {
    this.dispatchEvent(new CustomEvent('resolved', { detail: { resort, live }, bubbles: true }));
  }
}

customElements.define('location-gate', LocationGate);
