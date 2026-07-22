import { loadGraph } from './graph.js';
import { findRoutes } from './pathfinder.js';
import { fetchWeather } from './weather.js';
import { fetchOpenPiste, mergeConditions } from './conditions.js';
import './components/station-input.js';
import './components/difficulty-selector.js';
import './components/preference-selector.js';
import './components/route-result.js';
import './components/tab-bar.js';
import './components/location-gate.js';
import './components/weather-hero.js';
import './components/avalanche-banner.js';
import './components/lift-status-list.js';

const form       = document.querySelector('.search-form');
const startEl    = document.querySelector('station-input[name="start"]');
const destEl     = document.querySelector('station-input[name="destination"]');
const diffEl     = document.querySelector('difficulty-selector');
const prefEl     = document.querySelector('preference-selector');
const resultEl   = document.querySelector('route-result');
const errorEl    = document.querySelector('.form-error');
const gateEl     = document.querySelector('location-gate');
const heroEl     = document.querySelector('weather-hero');
const homeAvalancheEl   = document.querySelector('#view-home avalanche-banner');
const liftsEl           = document.querySelector('#view-lifts lift-status-list');
const alertsAvalancheEl = document.querySelector('#view-alerts avalanche-banner');
const alertsLiftsEl     = document.querySelector('#view-alerts lift-status-list');
const alertsContentEl   = document.querySelector('.alerts-content');
const alertsEmptyEl     = document.querySelector('.alerts-empty');
const headerEl          = document.querySelector('.app-header');
const headerTempEl      = document.querySelector('.header-temp');

alertsLiftsEl.closuresOnly = true;

// ── Resort resolution (geolocation / manual pick) ───────────────────────────

const RESORT_STORAGE_KEY = 'cds:selected-resort';
let currentResort = null;

async function initLocation() {
  const res     = await fetch('data/resorts.json');
  const { resorts } = await res.json();
  gateEl.resorts = resorts;

  const savedSlug = localStorage.getItem(RESORT_STORAGE_KEY);
  const saved     = savedSlug && resorts.find(r => r.slug === savedSlug);
  if (saved) {
    onResortResolved(saved, false);
  } else {
    gateEl.hidden = false;
  }
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
  currentResort = resort;
  gateEl.hidden = true;
  // Reset to loading state while fresh conditions are fetched.
  heroEl.data           = undefined;
  homeAvalancheEl.data  = undefined;
  liftsEl.lifts         = undefined;
  alertsAvalancheEl.data = undefined;
  alertsLiftsEl.lifts    = undefined;
  alertsEmptyEl.hidden   = true;
  setAlertsAvailable(false);
  loadConditions(resort, live);
}

function loadConditions(resort, live) {
  loadWeather(resort, live);
  loadAvalancheAndLifts(resort);
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
  if (!weather) { heroEl.data = null; headerTempEl.textContent = ''; return; }
  heroEl.data = {
    resortName: resort.name,
    country:    resort.country,
    elevation:  resort.elevation,
    live,
    ...weather,
  };
  headerTempEl.textContent = `${Math.round(weather.temp)}°C`;
}

// ── Avalanche risk + lift status ────────────────────────────────────────────

const CONDITIONS_CACHE_PREFIX = 'cds:conditions:';
let staticAvalanche  = null; // { [slug]: { level, sector, note } }
let staticLiftStatus = null; // { [slug]: [{ name, status }] }

async function loadStaticFallbacks() {
  if (staticAvalanche && staticLiftStatus) return;
  const [avaRes, liftRes] = await Promise.all([
    fetch('data/avalanche.json'),
    fetch('data/lift-status.json'),
  ]);
  staticAvalanche  = (await avaRes.json()).resorts;
  staticLiftStatus = (await liftRes.json()).resorts;
}

async function loadAvalancheAndLifts(resort) {
  const cacheKey = CONDITIONS_CACHE_PREFIX + resort.slug;
  await loadStaticFallbacks();
  const staticAva   = staticAvalanche[resort.slug] ?? null;
  const staticLifts = staticLiftStatus[resort.slug] ?? null;

  try {
    const openPiste = await fetchOpenPiste(resort.slug);
    const merged  = mergeConditions(openPiste, staticAva, staticLifts);
    const payload = { ...merged, updatedAt: Date.now() };
    localStorage.setItem(cacheKey, JSON.stringify(payload));
    applyConditions(payload);
  } catch (err) {
    console.error('open-piste fetch failed:', err);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      applyConditions(JSON.parse(cached));
    } else {
      // No live data and no cache yet — render the static fallback so the
      // dashboard is never blank, without claiming it was just fetched.
      const merged = mergeConditions({}, staticAva, staticLifts);
      applyConditions({ ...merged, updatedAt: null });
    }
  }
}

function applyConditions({ avalanche, lifts, liftsLive, updatedAt }) {
  const avalancheData = avalanche ? { ...avalanche, updatedAt } : null;
  const estimated      = lifts != null && !liftsLive;

  homeAvalancheEl.data    = avalancheData;
  liftsEl.lifts           = lifts;
  liftsEl.estimated       = estimated;

  alertsAvalancheEl.data  = avalancheData;
  alertsLiftsEl.lifts     = lifts;
  alertsLiftsEl.estimated = estimated;

  const closedCount = (lifts ?? []).filter(l => l.status !== 'open').length;
  const riskLevel   = avalancheData?.level ?? 0;
  const hasAlerts   = riskLevel >= 2 || closedCount > 0;
  alertsContentEl.hidden = !hasAlerts;
  alertsEmptyEl.hidden    = hasAlerts;
  setAlertsAvailable(hasAlerts);
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

// ── Header scroll behaviour ─────────────────────────────────────────────────
// The header shrinks once the page has scrolled at all, and shows the current
// temperature once the weather hero card has scrolled out of view — so the
// reading stays visible while browsing lift status / route results further
// down the page.

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
  headerEl.classList.toggle('app-header--show-temp', heroOutOfView && !views.home.hidden);
}

const heroObserver = new IntersectionObserver(([entry]) => {
  heroOutOfView = !entry.isIntersecting;
  updateHeaderTemp();
}, { threshold: 0 });
heroObserver.observe(heroEl);

// ── Tab navigation ───────────────────────────────────────────────────────────

const tabBar = document.querySelector('tab-bar');
const views  = {
  home:   document.getElementById('view-home'),
  lifts:  document.getElementById('view-lifts'),
  alerts: document.getElementById('view-alerts'),
};
// Hidden until conditions data actually confirms there's something to alert about.
tabBar.alertsAvailable = false;

function viewFromHash() {
  const v = location.hash.slice(1);
  return views[v] ? v : 'home';
}

function showView(view) {
  for (const [name, el] of Object.entries(views)) el.hidden = name !== view;
  tabBar.active = view;
  updateHeaderTemp();
}

tabBar.addEventListener('change', e => {
  location.hash = e.detail.view;
});
window.addEventListener('hashchange', () => showView(viewFromHash()));
showView(viewFromHash());

// Tapping the Home avalanche banner surfaces more detail in the Alerts view.
homeAvalancheEl.addEventListener('details', () => { location.hash = 'alerts'; });

let graph;
let nodeMap;

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
}

// ── Search ───────────────────────────────────────────────────────────────────

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
});

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('visible');
}

// ── Start ────────────────────────────────────────────────────────────────────

init().catch(err => {
  console.error('Failed to load network data:', err);
  showError('Could not load resort data. Make sure the app is served from a local server.');
});

initLocation().catch(err => {
  console.error('Failed to load resorts data:', err);
});
