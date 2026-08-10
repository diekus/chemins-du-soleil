import { loadGraph } from './graph.js';
import { findRoutes } from './pathfinder.js';
import { fetchWeather } from './weather.js';
import { fetchOpenPiste, readAvalanche } from './conditions.js';
import { nearestResort, VICINITY_KM } from './geo.js';
import './components/station-input.js';
import './components/difficulty-selector.js';
import './components/preference-selector.js';
import './components/route-result.js';
import './components/tab-bar.js';
import './components/location-gate.js';
import './components/weather-hero.js';
import './components/avalanche-banner.js';
import './components/resort-conditions-list.js';

const form       = document.querySelector('.search-form');
const startEl    = document.querySelector('station-input[name="start"]');
const destEl     = document.querySelector('station-input[name="destination"]');
const diffEl     = document.querySelector('difficulty-selector');
const prefEl     = document.querySelector('preference-selector');
const resultEl   = document.querySelector('route-result');
const errorEl    = document.querySelector('.form-error');
const gateEl     = document.querySelector('location-gate');
const heroEl     = document.querySelector('weather-hero');
const alertsAvalancheEl = document.querySelector('#view-alerts avalanche-banner');
const alertsContentEl   = document.querySelector('.alerts-content');
const alertsEmptyEl     = document.querySelector('.alerts-empty');
const headerEl          = document.querySelector('.app-header');
const headerTempEl      = document.querySelector('.header-temp');
const resortsOverviewEl = document.querySelector('resort-conditions-list');

// ── Resort resolution (geolocation / manual pick) ───────────────────────────

const RESORT_STORAGE_KEY = 'cds:selected-resort';
let currentResort = null;

let resolveResortsReady;
const resortsReady = new Promise(resolve => { resolveResortsReady = resolve; });

async function initLocation() {
  const res     = await fetch('data/resorts.json');
  const { resorts } = await res.json();
  gateEl.resorts = resorts;
  resolveResortsReady(resorts);

  // The live weather card is only meaningful on the mountain. Silently
  // re-check geolocation on every load (independent of how the resort was
  // resolved) and hide the card if the user isn't near any known resort.
  heroEl.hidden = true;
  checkVicinity(resorts).then(inVicinity => {
    heroEl.hidden = !inVicinity;
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
  currentResort = resort;
  gateEl.hidden = true;
  // Reset to loading state while fresh conditions are fetched.
  heroEl.data             = undefined;
  heroEl.avalanche        = undefined;
  alertsAvalancheEl.data  = undefined;
  alertsEmptyEl.hidden   = true;
  setAlertsAvailable(false);
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
  const avalancheData = avalanche ? { ...avalanche, updatedAt } : null;

  heroEl.avalanche        = avalancheData;
  alertsAvalancheEl.data  = avalancheData;

  const riskLevel = avalancheData?.level ?? 0;
  const hasAlerts = riskLevel >= 2;
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
  home:    document.getElementById('view-home'),
  resorts: document.getElementById('view-resorts'),
  alerts:  document.getElementById('view-alerts'),
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
  if (view === 'resorts') loadResortsOverview();
}

tabBar.addEventListener('change', e => {
  location.hash = e.detail.view;
});
window.addEventListener('hashchange', () => showView(viewFromHash()));
showView(viewFromHash());

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
