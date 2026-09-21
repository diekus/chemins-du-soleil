import { loadGraph } from './graph.js';
import { findRoutes } from './pathfinder.js';
import { fetchWeather, weatherIconKey, deriveCautions } from './weather.js';
import { fetchOpenPiste, readAvalanche } from './conditions.js';
import { nearestResort, VICINITY_KM, projectOntoRoute } from './geo.js';
import { FLAGS } from './countries.js';
import { WEATHER_ICONS } from './icons.js';
import { animateHeightChange } from './animate-height.js';
import './components/station-input.js';
import './components/difficulty-selector.js';
import './components/preference-selector.js';
import './components/route-result.js';
import './components/route-detail.js';
import './components/tab-bar.js';
import './components/location-gate.js';
import './components/weather-hero.js';
import './components/avalanche-banner.js';
import './components/weather-caution-list.js';
import './components/resort-conditions-list.js';

const form       = document.querySelector('.search-form');
const startEl    = document.querySelector('station-input[name="start"]');
const destEl     = document.querySelector('station-input[name="destination"]');
const diffEl     = document.querySelector('difficulty-selector');
const prefEl     = document.querySelector('preference-selector');
const resultEl   = document.querySelector('route-result');
const searchPanelEl = document.querySelector('.search-panel');
const summaryEl  = document.querySelector('.search-summary');
const errorEl    = document.querySelector('.form-error');
const gateEl     = document.querySelector('location-gate');
const heroEl     = document.querySelector('weather-hero');
const alertsAvalancheEl = document.querySelector('#view-alerts avalanche-banner');
const alertsContentEl   = document.querySelector('.alerts-content');
const alertsEmptyEl     = document.querySelector('.alerts-empty');
const cautionListEl     = document.querySelector('weather-caution-list');
const cautionsContentEl = document.querySelector('.cautions-content');
const cautionsEmptyEl   = document.querySelector('.cautions-empty');
const headerEl          = document.querySelector('.app-header');
const headerTempIconEl  = document.querySelector('.header-temp-icon');
const headerTempValueEl = document.querySelector('.header-temp-value');
const resortsOverviewEl = document.querySelector('resort-conditions-list');
const detailEl          = document.querySelector('route-detail');

// Declared here rather than beside the functions that use it further down:
// stopRouteTracking() runs synchronously from the very first render() call
// in the tab-navigation section below, so this must exist before that point.
let geoWatchId = null;

// ── Resort resolution (geolocation / manual pick) ───────────────────────────

const RESORT_STORAGE_KEY = 'cds:selected-resort';

let resolveResortsReady;
const resortsReady = new Promise(resolve => { resolveResortsReady = resolve; });

async function initLocation() {
  const res     = await fetch('data/resorts.json');
  const { resorts } = await res.json();
  gateEl.resorts = resorts;
  resolveResortsReady(resorts);
  loadAlertsOverview(resorts);

  // Silently re-check geolocation on every load (independent of how the
  // resort was resolved) and let the card know whether the device is
  // actually nearby — it stays visible either way (the user may have picked
  // a resort deliberately) but shows a note when it isn't.
  heroEl.hidden = true;
  checkVicinity(resorts).then(inVicinity => {
    heroEl.inVicinity = inVicinity;
    updateHeaderTemp();
  });

  const savedSlug = localStorage.getItem(RESORT_STORAGE_KEY);
  const saved     = savedSlug && resorts.find(r => r.slug === savedSlug);
  if (saved) {
    onResortResolved(saved, false);
  } else {
    gateEl.hidden = false;
  }
}

/** Resolves true if the browser's current position is within VICINITY_KM of any resort. */
function checkVicinity(resorts) {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) { resolve(false); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const nearest = nearestResort(pos.coords.latitude, pos.coords.longitude, resorts);
        resolve(nearest != null && nearest.km <= VICINITY_KM);
      },
      () => resolve(false),
      { timeout: 10000, maximumAge: 300000 },
    );
  });
}

gateEl.addEventListener('resolved', e => {
  localStorage.setItem(RESORT_STORAGE_KEY, e.detail.resort.slug);
  onResortResolved(e.detail.resort, e.detail.live);
});

heroEl.addEventListener('change-resort', () => {
  localStorage.removeItem(RESORT_STORAGE_KEY);
  gateEl.reopen();
});

function onResortResolved(resort, live) {
  gateEl.hidden = true;
  heroEl.hidden = false;
  // Reset to loading state while fresh conditions are fetched.
  heroEl.data             = undefined;
  heroEl.avalanche        = undefined;
  loadConditions(resort, live);
}

function loadConditions(resort, live) {
  loadWeather(resort, live);
  loadAvalanche(resort);
}

// ── Weather ──────────────────────────────────────────────────────────────────

const WEATHER_CACHE_PREFIX = 'cds:weather:';

async function loadWeather(resort, live) {
  const cacheKey = WEATHER_CACHE_PREFIX + resort.slug;
  try {
    const weather = await fetchWeather(resort.lat, resort.lon);
    const payload = { ...weather, updatedAt: Date.now() };
    localStorage.setItem(cacheKey, JSON.stringify(payload));
    setHeroData(resort, live, payload);
  } catch (err) {
    console.error('Weather fetch failed, falling back to cached reading:', err);
    const cached = localStorage.getItem(cacheKey);
    setHeroData(resort, live, cached ? JSON.parse(cached) : null);
  }
}

function setHeroData(resort, live, weather) {
  if (!weather) {
    heroEl.data = null;
    headerTempIconEl.innerHTML  = '';
    headerTempValueEl.textContent = '';
    return;
  }
  heroEl.data = {
    resortName: resort.name,
    country:    resort.country,
    elevation:  resort.elevation,
    live,
    ...weather,
  };
  headerTempIconEl.innerHTML    = WEATHER_ICONS[weatherIconKey(weather.weatherCode, weather.isDay)];
  headerTempValueEl.textContent = `${Math.round(weather.temp)}°C`;
}

// ── Avalanche risk ───────────────────────────────────────────────────────────

const CONDITIONS_CACHE_PREFIX = 'cds:conditions:';

async function loadAvalanche(resort) {
  const cacheKey = CONDITIONS_CACHE_PREFIX + resort.slug;
  try {
    const openPiste = await fetchOpenPiste(resort.slug);
    const read    = readAvalanche(openPiste);
    const payload = { ...read, updatedAt: Date.now() };
    localStorage.setItem(cacheKey, JSON.stringify(payload));
    applyConditions(payload);
  } catch (err) {
    console.error('open-piste fetch failed:', err);
    const cached = localStorage.getItem(cacheKey);
    applyConditions(cached ? JSON.parse(cached) : { avalanche: null, updatedAt: null });
  }
}

function applyConditions({ avalanche, updatedAt }) {
  heroEl.avalanche = avalanche ? { ...avalanche, updatedAt } : null;
}

// ── Alerts overview (avalanche risk + weather cautions, all PdS resorts) ────
// Runs once resorts.json is loaded, independent of which resort (if any) the
// user has resolved — you can be skiing in one resort and want to know about
// elevated risk or rough weather in a neighbouring one you might cross into.
// Avalanche risk is live only where open-piste has a matching resort record;
// everywhere else it's excluded rather than guessed — see data/resorts.json
// _meta. Weather cautions (deriveCautions() in weather.js) are threshold
// nudges computed from the same live Open-Meteo reading shown elsewhere in
// the app — not an official weather-service alert (Open-Meteo doesn't have
// one), so they're kept visually and textually distinct from the avalanche
// banner above.

const ALERT_RISK_THRESHOLD = 2;
const ALERTS_CACHE_KEY = 'cds:alerts-overview';

async function loadAlertsOverview(resorts) {
  alertsAvalancheEl.data = undefined;
  cautionListEl.cautions = undefined;

  try {
    const results = await Promise.all(resorts.map(loadResortAlertData));

    const avalanche = results
      .filter(r => r.avalanche && r.avalanche.level >= ALERT_RISK_THRESHOLD)
      .sort((a, b) => b.avalanche.level - a.avalanche.level)
      .map(r => ({ ...r.avalanche, slug: r.slug, name: r.name, country: r.country }));

    const cautions = results
      .filter(r => r.cautions.length > 0)
      .map(r => ({ slug: r.slug, name: r.name, country: r.country, cautions: r.cautions }));

    localStorage.setItem(ALERTS_CACHE_KEY, JSON.stringify({ avalanche, cautions }));
    applyAlertsOverview(avalanche, cautions);
  } catch (err) {
    console.error('Alerts overview fetch failed:', err);
    const cached = JSON.parse(localStorage.getItem(ALERTS_CACHE_KEY) || 'null');
    applyAlertsOverview(cached?.avalanche ?? null, cached?.cautions ?? null);
  }
}

async function loadResortAlertData(resort) {
  const [weather, openPiste] = await Promise.all([
    fetchWeather(resort.lat, resort.lon).catch(() => null),
    fetchOpenPiste(resort.slug).catch(() => ({})),
  ]);
  const { avalanche } = readAvalanche(openPiste);
  return {
    slug:      resort.slug,
    name:      resort.name,
    country:   resort.country,
    avalanche: avalanche ? { ...avalanche, updatedAt: Date.now() } : null,
    cautions:  deriveCautions(weather),
  };
}

function applyAlertsOverview(avalanche, cautions) {
  alertsAvalancheEl.data = avalanche;
  cautionListEl.cautions = cautions;

  const hasAvalanche = !!avalanche && avalanche.length > 0;
  const hasCautions  = !!cautions && cautions.length > 0;
  alertsContentEl.hidden   = !hasAvalanche;
  alertsEmptyEl.hidden     = hasAvalanche;
  cautionsContentEl.hidden = !hasCautions;
  cautionsEmptyEl.hidden   = hasCautions;
  setAlertsAvailable(hasAvalanche || hasCautions);
}

/**
 * Show or remove the Alerts tab from the bottom nav. If it's being removed
 * while the user is currently looking at it, navigate back to Home rather
 * than leaving an orphaned view with no active tab.
 */
function setAlertsAvailable(available) {
  tabBar.alertsAvailable = available;
  if (!available && !views.alerts.hidden) {
    location.hash = 'home';
  }
}

// ── Resorts overview (all Portes du Soleil resorts) ─────────────────────────
// Weather is always live (Open-Meteo covers any coordinate). Avalanche risk is
// live only where open-piste has a matching resort record; everywhere else it
// reports as unavailable rather than guessing — see data/resorts.json _meta.

const RESORTS_OVERVIEW_CACHE_KEY = 'cds:resorts-overview';
let resortsOverviewStarted = false;

async function loadResortsOverview() {
  if (resortsOverviewStarted) return;
  resortsOverviewStarted = true;

  resortsOverviewEl.resorts = undefined;
  const resorts = await resortsReady;

  try {
    const results = await Promise.all(resorts.map(loadResortSummary));
    resortsOverviewEl.resorts = results;
    localStorage.setItem(RESORTS_OVERVIEW_CACHE_KEY, JSON.stringify(results));
  } catch (err) {
    console.error('Resort overview fetch failed:', err);
    const cached = localStorage.getItem(RESORTS_OVERVIEW_CACHE_KEY);
    resortsOverviewEl.resorts = cached ? JSON.parse(cached) : null;
  }
}

async function loadResortSummary(resort) {
  const [weather, openPiste] = await Promise.all([
    fetchWeather(resort.lat, resort.lon).catch(() => null),
    fetchOpenPiste(resort.slug).catch(() => ({})),
  ]);
  const { avalanche } = readAvalanche(openPiste);
  return {
    slug:      resort.slug,
    name:      resort.name,
    country:   resort.country,
    elevation: resort.elevation,
    weather,
    avalanche,
  };
}

// ── Header scroll behaviour ─────────────────────────────────────────────────
// The header shrinks once the page has scrolled at all, and shows the current
// temperature once the weather hero card has scrolled out of view — so the
// reading stays visible while browsing route results further down the page.

// Two thresholds, not one: toggling --compact changes the header's own height
// (padding/logo size), which shifts scrollY right at the boundary and can
// flip a single threshold back and forth every frame. A dead zone between
// "become compact" and "expand again" prevents that feedback loop.
const HEADER_COMPACT_ON  = 40; // px — scroll past this to become compact
const HEADER_COMPACT_OFF = 10; // px — scroll back below this to expand again

function updateHeaderCompact() {
  const y = window.scrollY;
  if (y > HEADER_COMPACT_ON) {
    headerEl.classList.add('app-header--compact');
  } else if (y < HEADER_COMPACT_OFF) {
    headerEl.classList.remove('app-header--compact');
  }
  // Between the two thresholds: leave the current state alone.
}
window.addEventListener('scroll', updateHeaderCompact, { passive: true });

let heroOutOfView = false;

function updateHeaderTemp() {
  headerEl.classList.toggle('app-header--show-temp', heroOutOfView && !views.home.hidden && !heroEl.hidden);
}

const heroObserver = new IntersectionObserver(([entry]) => {
  heroOutOfView = !entry.isIntersecting;
  updateHeaderTemp();
}, { threshold: 0 });
heroObserver.observe(heroEl);

// ── Tab navigation ───────────────────────────────────────────────────────────

const tabBar = document.querySelector('tab-bar');
const views  = {
  home:        document.getElementById('view-home'),
  resorts:     document.getElementById('view-resorts'),
  alerts:      document.getElementById('view-alerts'),
  routeDetail: document.getElementById('view-route-detail'),
};
// Hidden until conditions data actually confirms there's something to alert about.
tabBar.alertsAvailable = false;

// A route's detail page is addressed as "#route?from=..&to=..&max=..&pref=..&i=.."
// rather than a plain tab name, so a link to it can be shared and reopened —
// including on a fresh load, once the graph has finished loading below.
function parseHash() {
  const raw = location.hash.slice(1);
  if (raw.startsWith('route?')) {
    return { view: 'routeDetail', params: new URLSearchParams(raw.slice('route?'.length)) };
  }
  return { view: views[raw] ? raw : 'home', params: null };
}

function showView(view, params) {
  // Each view is conceptually its own "page" (most visible on route-detail's
  // full-bleed map hero, whose back/zoom/compass controls sit right at the
  // top) — without this, navigating here mid-scroll (e.g. after focusing the
  // destination input scrolled the page down) leaves those controls stranded
  // off-screen above the viewport, exactly like a real page nav resetting scroll.
  window.scrollTo(0, 0);

  for (const [name, el] of Object.entries(views)) el.hidden = name !== view;
  // routeDetail isn't a tab — leave the tab bar's own active tab (Home) alone.
  if (view !== 'routeDetail') { tabBar.active = view; stopRouteTracking(); }
  updateHeaderTemp();
  if (view === 'resorts')     loadResortsOverview();
  if (view === 'routeDetail') showRouteDetail(params);
}

function render() {
  const { view, params } = parseHash();
  showView(view, params);
}

let graph;
let nodeMap;

let resolveGraphReady;
const graphReady = new Promise(resolve => { resolveGraphReady = resolve; });

tabBar.addEventListener('change', e => {
  location.hash = e.detail.view;
});
window.addEventListener('hashchange', render);
render();

async function showRouteDetail(params) {
  detailEl.route = undefined; // loading state while the graph/route resolve
  await graphReady;

  const startId    = params.get('from');
  const endId      = params.get('to');
  const difficulty = params.get('max');
  const preference = params.get('pref') || null;
  const index      = Number(params.get('i')) || 0;

  const routes = findRoutes(graph, startId, endId, difficulty, 3, preference);
  const route  = routes[index] ?? null;

  detailEl.nodes            = nodeMap;
  detailEl.preferDifficulty = preference;
  detailEl.label            = index === 0 ? 'Best route' : `Alternative ${index + 1}`;
  detailEl.route            = route;

  if (route) {
    const points = route.path
      .map(id => nodeMap.get(id))
      .filter(n => n && typeof n.lat === 'number' && typeof n.lon === 'number')
      .map(n => ({ lat: n.lat, lon: n.lon }));
    if (points.length >= 2) startRouteTracking(points);
  }
}

// ── Live GPS route progress ─────────────────────────────────────────────────
// Only active while the route-detail page for that specific route is open —
// started in showRouteDetail above, stopped in showView whenever navigating
// away from it (see the routeDetail branch there).

function stopRouteTracking() {
  if (geoWatchId != null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
}

function startRouteTracking(points) {
  stopRouteTracking();

  if (!('geolocation' in navigator)) {
    detailEl.progress = 'denied';
    return;
  }

  detailEl.progress = 'waiting';
  geoWatchId = navigator.geolocation.watchPosition(
    pos => {
      // Ignore low-accuracy fixes rather than show a jumpy, misleading position.
      if (pos.coords.accuracy > 100) return;
      const result = projectOntoRoute(pos.coords.latitude, pos.coords.longitude, points);
      if (result) detailEl.progress = result;
    },
    err => {
      // PERMISSION_DENIED is a real "can't track" state; POSITION_UNAVAILABLE/
      // TIMEOUT are transient blips on the mountain — leave the last state showing.
      if (err.code === err.PERMISSION_DENIED) detailEl.progress = 'denied';
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  );
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  const res     = await fetch('data/network.json');
  const network = await res.json();

  graph   = loadGraph(network);
  nodeMap = new Map(network.nodes.map(n => [n.id, n]));

  // Junction nodes are routing-internal; only lifts and villages appear in search.
  const stations = network.nodes
    .filter(nd => nd.station_type !== 'junction')
    .map(({ id, name, country }) => ({ id, name, country }));
  startEl.stations = stations;
  destEl.stations  = stations;

  resolveGraphReady();
}

// ── Search ───────────────────────────────────────────────────────────────────

let lastSearch = null;

form.addEventListener('submit', e => {
  e.preventDefault();
  errorEl.classList.remove('visible');

  const startId    = startEl.value;
  const endId      = destEl.value;
  const difficulty = diffEl.value;
  const preference = prefEl.value || null;

  if (!startId || !endId) {
    showError('Please select both a start and a destination from the list.');
    return;
  }
  if (startId === endId) {
    showError('Start and destination must be different stations.');
    return;
  }

  // Pass nodes for country lookups and current preference for labelling, then set loading state.
  resultEl.nodes            = nodeMap;
  resultEl.preferDifficulty = preference;
  resultEl.routes           = null;

  // findRoutes is synchronous — set result immediately.
  resultEl.routes = findRoutes(graph, startId, endId, difficulty, 3, preference);

  // Remembered so a card click below can address the route's own page without
  // re-asking the form for values the user has already collapsed away.
  lastSearch = { startId, endId, difficulty, preference };

  collapseSearchForm(startId, endId, preference);
});

resultEl.addEventListener('routeselect', e => {
  if (!lastSearch) return;
  const params = new URLSearchParams({
    from: lastSearch.startId,
    to:   lastSearch.endId,
    max:  lastSearch.difficulty,
    i:    String(e.detail.index),
  });
  if (lastSearch.preference) params.set('pref', lastSearch.preference);
  location.hash = `route?${params.toString()}`;
});

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('visible');
}

// ── Collapse/expand search form into a summary bar after a successful search ──

function stationLabel(id) {
  const node = nodeMap.get(id);
  if (!node) return '';
  return `${FLAGS[node.country] ?? ''} ${node.name}`.trim();
}

function collapseSearchForm(startId, endId, preference) {
  summaryEl.querySelector('.search-summary-route').textContent =
    `${stationLabel(startId)} → ${stationLabel(endId)}`;
  summaryEl.querySelector('.search-summary-pref').textContent =
    preference ? `Prefers ${preference}` : 'No difficulty preference';

  animateHeightChange(searchPanelEl, () => {
    form.hidden      = true;
    summaryEl.hidden = false;
  });
}

summaryEl.addEventListener('click', () => {
  animateHeightChange(searchPanelEl, () => {
    summaryEl.hidden = true;
    form.hidden      = false;
  });
  form.querySelector('station-input[name="start"] .si-input')?.focus();
});

// ── Start ────────────────────────────────────────────────────────────────────

init().catch(err => {
  console.error('Failed to load network data:', err);
  showError('Could not load resort data. Make sure the app is served from a local server.');
});

initLocation().catch(err => {
  console.error('Failed to load resorts data:', err);
});
