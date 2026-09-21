// Loads Leaflet from a CDN on first use (no bundler/build step in this app —
// see specs/mapping.md for why Leaflet + OpenStreetMap was picked: no API
// key, no billing account, small footprint). Cached as a singleton promise
// so multiple map instances (or repeated route navigations) only fetch it once.

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_BASE    = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist`;

let leafletPromise = null;

/** Resolves with the global `L` namespace, loading Leaflet's JS/CSS on first call. */
export function loadLeaflet() {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }

    const cssHref = `${LEAFLET_BASE}/leaflet.css`;
    if (!document.querySelector(`link[href="${cssHref}"]`)) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = cssHref;
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src   = `${LEAFLET_BASE}/leaflet.js`;
    script.onload = () => {
      // Leaflet's default marker icon resolves image paths relative to the
      // page's own URL when loaded outside a bundler, which breaks (broken
      // image icon) unless pointed at the CDN copies explicitly.
      delete window.L.Icon.Default.prototype._getIconUrl;
      window.L.Icon.Default.mergeOptions({
        iconRetinaUrl: `${LEAFLET_BASE}/images/marker-icon-2x.png`,
        iconUrl:       `${LEAFLET_BASE}/images/marker-icon.png`,
        shadowUrl:     `${LEAFLET_BASE}/images/marker-shadow.png`,
      });
      resolve(window.L);
    };
    script.onerror = () => reject(new Error('Failed to load Leaflet from CDN'));
    document.head.appendChild(script);
  });

  return leafletPromise;
}
