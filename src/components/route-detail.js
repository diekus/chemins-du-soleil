import { ICONS } from '../icons.js';
import { dedupeSteps, stepHTML, prefBadgeHTML } from '../route-view.js';
import { loadLeaflet } from '../leaflet-loader.js';
import { isOrientationSupported, requestOrientationPermission, getCompassHeading } from '../compass.js';

/**
 * Full-page view of a single route, reached from a <route-result> card.
 * The map is Leaflet + OpenStreetMap tiles — see specs/mapping.md for why.
 */
// Beyond this, a GPS fix is treated as "not actually on this route" rather
// than shown as a (misleadingly precise-looking) progress percentage.
const OFF_ROUTE_KM = 1.5;

// Gyroscope/magnetometer-driven "rotate with heading" only makes sense on a
// handheld device with those sensors — feature-detected once at module load
// (touch capability is used as the "handheld" proxy) rather than per render.
const COMPASS_AVAILABLE = isOrientationSupported()
  && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

class RouteDetail extends HTMLElement {
  #route            = undefined; // undefined=loading, null=not found, Route=loaded
  #nodes            = new Map();
  #preferDifficulty = null;
  #label            = '';
  // null=no GPS attempt yet, 'waiting'=watching but no fix, 'denied'=no
  // permission/support, or the { progress, distanceKm, lat, lon } result of a live fix.
  #progress         = null;

  #map              = null; // Leaflet map instance for the currently rendered route, if loaded
  #youAreHereMarker = null;
  #rotor            = null; // oversized div Leaflet actually renders into — see #initMap
  #compassActive    = false;
  #orientationHandler = null;
  #pendingHeading   = null;
  #rafId            = null;
  // Whether the map card (and its zoom/compass/attribution controls) was
  // skipped on the last render because the device was offline — checked
  // when connectivity returns so the map can be shown once it's actually
  // usable again, see the 'online' listener in connectedCallback().
  #offlineAtRender  = false;
  // 'large' | 'small' — user-toggleable map card height, see #toggleMapSize().
  #mapSize          = 'large';

  set nodes(map) { this.#nodes = map instanceof Map ? map : new Map(); }
  set preferDifficulty(val) { this.#preferDifficulty = val || null; }
  set label(val) { this.#label = val || ''; }

  /** undefined=loading, null=not found, Route object=loaded. */
  set route(val) {
    this.#route    = val;
    this.#progress = null;
    this.#mapSize  = 'large';
    this.#render();
  }

  /** null | 'waiting' | 'denied' | { progress: 0-1, distanceKm, lat, lon }. Updated live from GPS. */
  set progress(val) {
    this.#progress = val;
    this.#renderProgress();
  }

  connectedCallback() {
    this.addEventListener('click', e => {
      if (e.target.closest('.detail-share-btn'))      this.#share();
      if (e.target.closest('.detail-zoom-in'))         this.#map?.zoomIn();
      if (e.target.closest('.detail-zoom-out'))        this.#map?.zoomOut();
      if (e.target.closest('.detail-compass-toggle'))  this.#toggleCompass();
      if (e.target.closest('.detail-map-size-toggle')) this.#toggleMapSize();
    });

    // The map card needs a live network connection (tile images, and the
    // Leaflet library itself on a first-ever visit) — offline, it's hidden
    // in favour of a plain back link rather than showing broken grey tiles
    // (see #render()/#detailHTML()). If connectivity returns while that's
    // the state showing, re-render once to bring the map back.
    window.addEventListener('online', () => {
      if (this.#offlineAtRender && this.#route) this.#render();
    });
  }

  #render() {
    // Whatever branch we're rendering wipes the previous route's DOM (map
    // container included) — tear the old Leaflet instance down first so it
    // doesn't leak its resize/window listeners.
    this.#teardownMap();

    const r = this.#route;
    if (r === undefined) { this.innerHTML = this.#loadingHTML();  return; }
    if (r === null)      { this.innerHTML = this.#notFoundHTML(); return; }

    this.#offlineAtRender = !navigator.onLine;
    this.innerHTML = this.#detailHTML(r, this.#offlineAtRender);
    this.#renderProgress();
    if (!this.#offlineAtRender) this.#initMap(r);
  }

  #teardownMap() {
    this.#stopCompass();
    if (this.#map) {
      this.#map.remove();
      this.#map = null;
    }
    this.#rotor            = null;
    this.#youAreHereMarker = null;
  }

  /** Swaps the map card between its 'large' and 'small' heights. */
  #toggleMapSize() {
    if (!this.#route) return;
    this.#mapSize = this.#mapSize === 'large' ? 'small' : 'large';

    const card = this.querySelector('.detail-map-card');
    card?.classList.toggle('detail-map-card--large', this.#mapSize === 'large');
    card?.classList.toggle('detail-map-card--small', this.#mapSize === 'small');

    const toggleBtn = this.querySelector('.detail-map-size-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = this.#mapSize === 'large' ? 'Show smaller map' : 'Show larger map';
      toggleBtn.setAttribute('aria-expanded', String(this.#mapSize === 'large'));
    }

    // The card's own footprint just changed size — rebuild the map rather
    // than trying to patch it in place, so Leaflet recalculates its tile
    // grid and the compass rotor (sized off the card's diagonal, see
    // #initMap) recomputes for the new dimensions instead of staying sized
    // for the old ones.
    this.#teardownMap();
    this.#initMap(this.#route);
  }

  // ── Map ───────────────────────────────────────────────────────────────────

  async #initMap(route) {
    const container = this.querySelector('.detail-map');
    if (!container) return;

    // route.steps[i] always connects nodeCoords[i] → nodeCoords[i+1] (one
    // step per path edge), which is what lets each step be drawn in its own
    // difficulty colour below.
    const nodeCoords = route.path.map(id => this.#nodes.get(id));
    const hasCoords  = n => n && typeof n.lat === 'number' && typeof n.lon === 'number';

    if (!nodeCoords.some(hasCoords)) {
      container.textContent = 'Map unavailable for this route.';
      return;
    }

    let L;
    try {
      L = await loadLeaflet();
    } catch (err) {
      console.error(err);
      container.textContent = 'Map could not be loaded.';
      return;
    }

    // The route may have changed (or the page navigated away) while Leaflet
    // was loading — bail out rather than mount a map for a stale route.
    if (this.#route !== route || !this.isConnected) return;

    container.innerHTML = '';

    // Leaflet mounts into this inner "rotor" div rather than .detail-map
    // itself, sized to the visible box's own diagonal and centred within
    // it — so that when compass mode rotates it, there's always enough
    // rendered map behind the (overflow:hidden) visible window to cover it,
    // whatever the rotation angle. Leaflet's own zoom/attribution controls
    // anchor to *this* (oversized, off-centre-cropped) container's corners,
    // which sit outside the visible viewport, so they're built as ordinary
    // fixed siblings of .detail-map instead (see .detail-zoom-controls /
    // .detail-map-attribution in #detailHTML and components.css).
    const rotor = document.createElement('div');
    rotor.className = 'detail-map-rotor';
    const size = Math.ceil(Math.hypot(container.offsetWidth, container.offsetHeight)) || 600;
    rotor.style.width  = `${size}px`;
    rotor.style.height = `${size}px`;
    container.appendChild(rotor);
    this.#rotor = rotor;

    const map = L.map(rotor, { scrollWheelZoom: false, zoomControl: false, attributionControl: false });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

    const style       = getComputedStyle(this);
    const cssVar      = name => style.getPropertyValue(name).trim();
    const primaryColor = cssVar('--color-primary') || '#1E7FBF';
    const fillColor     = cssVar('--color-surface') || '#ffffff';
    // Lifts carry no piste colour anywhere else in the app either (see the
    // route-step list) — drawn as a solid neutral line, not a slope colour.
    const liftColor      = cssVar('--color-text-secondary') || '#6B6B6B';
    const SLOPE_COLOR_VAR = {
      green: '--color-slope-green',
      blue:  '--color-slope-blue',
      red:   '--color-slope-red',
      black: '--color-slope-black',
    };

    // One polyline per step, coloured by that step's own difficulty, rather
    // than a single line for the whole route.
    const segments = [];
    route.steps.forEach((step, i) => {
      const from = nodeCoords[i], to = nodeCoords[i + 1];
      if (!hasCoords(from) || !hasCoords(to)) return; // gap — skip, don't misdraw
      const latlngs = [[from.lat, from.lon], [to.lat, to.lon]];
      segments.push(step.type === 'lift'
        ? L.polyline(latlngs, { color: liftColor, weight: 3, opacity: 0.95 })
        : L.polyline(latlngs, { color: cssVar(SLOPE_COLOR_VAR[step.difficulty]) || primaryColor, weight: 4, opacity: 0.9 }));
    });
    segments.forEach(seg => seg.addTo(map));

    const bounds = segments.length > 0 ? L.featureGroup(segments).getBounds() : null;
    const firstValid = nodeCoords.find(hasCoords);
    const lastValid   = [...nodeCoords].reverse().find(hasCoords);

    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] });
    } else if (firstValid) {
      map.setView([firstValid.lat, firstValid.lon], 15);
    }

    if (firstValid) {
      L.circleMarker([firstValid.lat, firstValid.lon], {
        radius: 7, color: primaryColor, weight: 2, fillColor: primaryColor, fillOpacity: 1,
      }).addTo(map).bindTooltip('Start');
    }
    if (lastValid && lastValid !== firstValid) {
      L.circleMarker([lastValid.lat, lastValid.lon], {
        radius: 7, color: primaryColor, weight: 2, fillColor, fillOpacity: 1,
      }).addTo(map).bindTooltip('Finish');
    }

    this.#map = map;
    this.#updateMapMarker(L); // in case a GPS fix already arrived while Leaflet was loading
  }

  // ── Compass (heading-up rotation) ────────────────────────────────────────

  /** Toggles device-orientation-driven map rotation on/off, requesting permission on first use. */
  async #toggleCompass() {
    if (this.#compassActive) { this.#stopCompass(); return; }

    const granted = await requestOrientationPermission();
    const statusEl = this.querySelector('.detail-compass-status');
    if (!granted) {
      if (statusEl) statusEl.textContent = 'Enable motion & orientation access to rotate the map with your heading.';
      return;
    }
    if (statusEl) statusEl.textContent = '';

    this.#compassActive = true;
    this.querySelector('.detail-compass-toggle')?.setAttribute('aria-pressed', 'true');

    // Dragging/pinch-zoom/double-click-zoom all convert a screen pixel to a
    // map coordinate assuming the container is unrotated — which it visibly
    // no longer is once the rotor spins — so they're disabled for as long as
    // compass mode is active rather than silently panning/zooming to the
    // wrong place. Only the (rotation-independent) custom zoom buttons and
    // pinch-free scrolling stay available.
    this.#map?.dragging.disable();
    this.#map?.touchZoom.disable();
    this.#map?.doubleClickZoom.disable();

    this.#orientationHandler = event => {
      const heading = getCompassHeading(event);
      if (heading == null) return;
      this.#pendingHeading = heading;
      if (this.#rafId != null) return;
      this.#rafId = requestAnimationFrame(() => {
        this.#rafId = null;
        if (this.#rotor) this.#rotor.style.transform = `translate(-50%, -50%) rotate(${-this.#pendingHeading}deg)`;
      });
    };
    // Chrome/Android fire 'deviceorientationabsolute'; iOS Safari only ever
    // fires plain 'deviceorientation' (with webkitCompassHeading attached) —
    // both are listened for, and getCompassHeading() ignores whichever one
    // doesn't carry a trustworthy north-referenced reading on this device.
    window.addEventListener('deviceorientationabsolute', this.#orientationHandler);
    window.addEventListener('deviceorientation', this.#orientationHandler);
  }

  #stopCompass() {
    this.#compassActive = false;
    this.querySelector('.detail-compass-toggle')?.setAttribute('aria-pressed', 'false');

    if (this.#orientationHandler) {
      window.removeEventListener('deviceorientationabsolute', this.#orientationHandler);
      window.removeEventListener('deviceorientation', this.#orientationHandler);
      this.#orientationHandler = null;
    }
    if (this.#rafId != null) { cancelAnimationFrame(this.#rafId); this.#rafId = null; }
    if (this.#rotor) this.#rotor.style.transform = 'translate(-50%, -50%) rotate(0deg)';

    this.#map?.dragging.enable();
    this.#map?.touchZoom.enable();
    this.#map?.doubleClickZoom.enable();
  }

  /** Adds/moves/removes the live "you are here" marker to match the current GPS state. */
  #updateMapMarker(L) {
    if (!this.#map) return;
    L ??= window.L;

    const p = this.#progress;
    const onRoute = p && typeof p === 'object' && p.distanceKm <= OFF_ROUTE_KM;

    if (!onRoute) {
      if (this.#youAreHereMarker) {
        this.#map.removeLayer(this.#youAreHereMarker);
        this.#youAreHereMarker = null;
      }
      return;
    }

    const latlng = [p.lat, p.lon];
    if (this.#youAreHereMarker) {
      this.#youAreHereMarker.setLatLng(latlng);
    } else {
      const icon = L.divIcon({
        className: 'route-map-you-are-here',
        iconSize:  [16, 16],
      });
      this.#youAreHereMarker = L.marker(latlng, { icon, zIndexOffset: 1000, keyboard: false })
        .addTo(this.#map)
        .bindTooltip('You are here');
    }
  }

  /**
   * Updates the progress rail/status text in place (not a full re-render) so
   * frequent GPS ticks don't reset scroll position or interrupt the share
   * status message. No-ops if the route itself isn't currently rendered.
   */
  #renderProgress() {
    const fillEl   = this.querySelector('.route-progress-fill');
    const dotEl    = this.querySelector('.route-progress-dot');
    const statusEl = this.querySelector('.route-progress-status');
    if (!fillEl || !dotEl || !statusEl) return;

    const p = this.#progress;

    const setBar = pct => {
      fillEl.style.height = `${pct}%`;
      dotEl.style.top      = `${pct}%`;
      dotEl.hidden         = pct === null;
    };

    if (p === null) {
      setBar(null);
      statusEl.textContent = '';
    } else if (p === 'waiting') {
      setBar(null);
      statusEl.textContent = 'Finding your position…';
    } else if (p === 'denied') {
      setBar(null);
      statusEl.textContent = 'Turn on location to track your progress on this route.';
    } else if (p.distanceKm > OFF_ROUTE_KM) {
      setBar(null);
      statusEl.textContent = "You don't seem to be on this route yet.";
    } else {
      const pct = Math.max(0, Math.min(100, Math.round(p.progress * 100)));
      setBar(pct);
      statusEl.textContent = pct >= 99
        ? "You've arrived — nice run!"
        : `Tracking your position live — ${pct}% of the way there.`;
    }

    this.#updateMapMarker();
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  #detailHTML(route, offline) {
    const displaySteps = dedupeSteps(route.steps, this.#nodes);
    const stops = `${displaySteps.length} stop${displaySteps.length !== 1 ? 's' : ''}`;
    const steps = displaySteps.map(s => stepHTML(s, this.#nodes)).join('');

    const prefCount = this.#preferDifficulty
      ? displaySteps.filter(s => s.difficulty === this.#preferDifficulty).length
      : 0;
    const prefBadge = prefBadgeHTML(this.#preferDifficulty, prefCount);

    // Offline, there's no map to show — the tile imagery needs a live
    // connection regardless of whether Leaflet itself happens to be cached
    // (see specs/mapping.md) — so the whole map section (and its zoom/
    // compass/attribution controls, which only make sense alongside a map)
    // is skipped in favour of the plain back link every other state here uses.
    const mapSection = offline ? `
      ${this.#backLinkHTML()}
      <p class="detail-map-offline">Map unavailable while offline.</p>
    ` : `
      <div class="detail-map-section">
        <div class="detail-map-card detail-map-card--${this.#mapSize}">
          <div class="detail-map" role="group" aria-label="Map of ${this.#label}">Loading map…</div>

          <a href="#home" class="detail-back-floating" aria-label="Back to results">
            ${ICONS.back}
          </a>

          <div class="detail-zoom-controls">
            <button type="button" class="detail-zoom-in" aria-label="Zoom in">+</button>
            <button type="button" class="detail-zoom-out" aria-label="Zoom out">&minus;</button>
          </div>

          ${COMPASS_AVAILABLE ? `
          <button type="button" class="detail-compass-toggle" aria-pressed="false" aria-label="Rotate map with your device heading">
            ${ICONS.compass}
          </button>` : ''}

          <p class="detail-map-attribution">
            &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
          </p>
        </div>

        <button type="button" class="detail-map-size-toggle btn-text" aria-expanded="${this.#mapSize === 'large'}">
          ${this.#mapSize === 'large' ? 'Show smaller map' : 'Show larger map'}
        </button>
      </div>
    `;

    return `
      ${mapSection}

      <div class="detail-body">
        ${!offline && COMPASS_AVAILABLE ? '<p class="detail-compass-status" role="status" aria-live="polite"></p>' : ''}

        <div class="route-card detail-card">
          <span class="route-card-header">
            <span class="route-label">${this.#label}</span>
            ${prefBadge}
            <span class="route-stops" aria-label="${route.steps.length} stops">${stops}</span>
          </span>

          <div class="route-progress">
            <div class="route-progress-track">
              <div class="route-progress-fill"></div>
              <div class="route-progress-dot" hidden></div>
            </div>
            <ol class="route-steps" aria-label="${this.#label}">${steps}</ol>
          </div>
          <p class="route-progress-status" role="status" aria-live="polite"></p>
        </div>

        <div class="detail-actions">
          <button type="button" class="btn-find detail-share-btn">
            <span class="detail-share-icon" aria-hidden="true">${ICONS.share}</span>
            Share this route
          </button>
        </div>
        <p class="detail-share-status" role="status" aria-live="polite"></p>
      </div>
    `;
  }

  #loadingHTML() {
    return `
      ${this.#backLinkHTML()}
      <div class="skeleton-card detail-skeleton" role="status" aria-busy="true" aria-label="Loading route…"></div>
    `;
  }

  #notFoundHTML() {
    return `
      ${this.#backLinkHTML()}
      <div class="no-route" role="status">
        <span class="no-route-icon" aria-hidden="true">${ICONS.ski}</span>
        <p class="no-route-title">Route not found</p>
        <p>This link may be broken, or the route no longer exists at that difficulty.</p>
      </div>
    `;
  }

  #backLinkHTML() {
    return `
      <a href="#home" class="detail-back">
        <span aria-hidden="true">${ICONS.back}</span> Back to results
      </a>
    `;
  }

  // ── Share ─────────────────────────────────────────────────────────────────

  async #share() {
    const statusEl = this.querySelector('.detail-share-status');
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Chemins du Soleil route', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      if (statusEl) statusEl.textContent = 'Link copied to clipboard.';
    } catch (err) {
      if (err?.name === 'AbortError') return; // user dismissed the share sheet
      console.error('Share failed:', err);
      if (statusEl) statusEl.textContent = 'Could not share this route — copy the address bar link instead.';
    }
  }
}

customElements.define('route-detail', RouteDetail);
