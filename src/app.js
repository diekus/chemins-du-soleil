import { loadGraph } from './graph.js';
import { findRoutes } from './pathfinder.js';
import './components/station-input.js';
import './components/difficulty-selector.js';
import './components/route-result.js';

const form       = document.querySelector('.search-form');
const startEl    = document.querySelector('station-input[name="start"]');
const destEl     = document.querySelector('station-input[name="destination"]');
const diffEl     = document.querySelector('difficulty-selector');
const resultEl   = document.querySelector('route-result');
const errorEl    = document.querySelector('.form-error');

let graph;
let nodeMap;

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  const res     = await fetch('data/network.json');
  const network = await res.json();

  graph   = loadGraph(network);
  nodeMap = new Map(network.nodes.map(n => [n.id, n]));

  const stations = network.nodes.map(({ id, name, country }) => ({ id, name, country }));
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

  if (!startId || !endId) {
    showError('Please select both a start and a destination from the list.');
    return;
  }
  if (startId === endId) {
    showError('Start and destination must be different stations.');
    return;
  }

  // Pass nodes for country lookups, then set loading state.
  resultEl.nodes  = nodeMap;
  resultEl.routes = null;

  // findRoutes is synchronous — set result immediately.
  resultEl.routes = findRoutes(graph, startId, endId, difficulty, 3);
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
