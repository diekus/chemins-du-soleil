// Lift & slope reference page (reference.html): every lift and named slope in
// data/network.json, grouped by resort, with a name filter. Built from the
// network at load time (see reference.js), so it always matches the routing
// data. Re-renders on 'localechange'.

import { t } from './i18n.js';
import './theme.js';
import { ICONS, liftIcon } from './icons.js';
import { FLAGS, COUNTRY_NAME } from './countries.js';
import { DIFFICULTY_NAME_KEY } from './route-view.js';
import { buildReference, SLOPE_DIFFICULTIES } from './reference.js';

const LIFT_TYPES = ['chairlift', 'gondola', 'surface'];

const main = document.getElementById('reference');
let reference = null;
// Which resorts were open before a search started, restored once it's cleared.
let preSearchOpen = null;

/** Case- and accent-insensitive form for matching ("ecoles" finds "Écoles"). */
const fold = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function liftHTML({ name, liftType }) {
  const type = LIFT_TYPES.includes(liftType) ? liftType : 'chairlift';
  return `
    <li data-name="${fold(name)}">
      <span class="ref-icon" role="img" aria-label="${t(`reference.liftType.${type}`)}">${liftIcon(type)}</span>
      <span>${name}</span>
    </li>`;
}

function resortHTML({ resort, lifts, slopes, unnamedSlopes }, open) {
  const slopeCount = SLOPE_DIFFICULTIES.reduce((n, d) => n + slopes[d].length, 0);
  const empty = !lifts.length && !slopeCount && !unnamedSlopes;

  const liftSection = lifts.length ? `
    <section class="ref-section">
      <h3>${t('reference.lifts')}</h3>
      <ul class="ref-list">${lifts.map(liftHTML).join('')}</ul>
    </section>` : '';

  const groups = SLOPE_DIFFICULTIES.filter(d => slopes[d].length).map(d => `
    <div class="ref-group">
      <h4><span class="diff-dot" data-d="${d}" aria-hidden="true"></span>${t(DIFFICULTY_NAME_KEY[d])}</h4>
      <ul class="ref-list">
        ${slopes[d].map(name => `<li data-d="${d}" data-name="${fold(name)}">${name}</li>`).join('')}
      </ul>
    </div>`).join('');

  const slopeSection = slopeCount || unnamedSlopes ? `
    <section class="ref-section">
      <h3>${t('reference.slopes')}</h3>
      ${groups}
      ${unnamedSlopes ? `<p class="ref-note" data-hide-on-search>${t('reference.unnamedSlopes', { count: unnamedSlopes })}</p>` : ''}
    </section>` : '';

  return `
    <details class="ref-resort" id="${resort.slug}"${open ? ' open' : ''}>
      <summary>
        <span aria-label="${COUNTRY_NAME[resort.country] ?? ''}">${FLAGS[resort.country] ?? ''}</span>
        <h2>${resort.name}</h2>
        <span class="ref-counts">
          ${t('reference.liftCount', { count: lifts.length })} · ${t('reference.slopeCount', { count: slopeCount })}
        </span>
        <span class="chevron" aria-hidden="true">${ICONS.chevronDown}</span>
      </summary>
      <div class="ref-body">
        ${empty ? `<p class="ref-note" data-hide-on-search>${t('reference.empty')}</p>` : ''}
        ${liftSection}
        ${slopeSection}
      </div>
    </details>`;
}

function render() {
  // Keep the search and any open resorts across a language switch.
  const query = main.querySelector('#ref-search')?.value ?? '';
  const wasOpen = new Set([...main.querySelectorAll('details[open]')].map(d => d.id));

  main.innerHTML = `
    <p class="back-link"><a href="index.html">&larr; ${t('setup.back')}</a></p>

    <div>
      <h1 class="section-label">${t('reference.title')}</h1>
      <p class="ref-intro">${t('reference.intro')}</p>
    </div>

    ${reference ? `
    <div class="form-row">
      <label for="ref-search">${t('reference.searchLabel')}</label>
      <input id="ref-search" class="ref-search" type="search" autocomplete="off" spellcheck="false">
    </div>
    <p class="ref-status" role="status" aria-live="polite"></p>
    <div class="ref-resorts">
      ${reference.map(entry => resortHTML(entry, wasOpen.has(entry.resort.slug))).join('')}
    </div>` : `<p class="ref-status" role="alert">${t('reference.errorLoad')}</p>`}
  `;

  const search = main.querySelector('#ref-search');
  if (search) {
    search.value = query;
    search.addEventListener('input', applySearch);
    if (query) applySearch();
  }

  document.title = `${t('reference.title')} — ${t('app.title')}`;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
}

function applySearch() {
  const raw = main.querySelector('#ref-search').value.trim();
  const query = fold(raw);
  const resorts = [...main.querySelectorAll('.ref-resort')];

  if (query && !preSearchOpen) preSearchOpen = new Set(resorts.filter(d => d.open).map(d => d.id));

  let anyMatch = false;
  for (const details of resorts) {
    let resortMatch = false;
    for (const li of details.querySelectorAll('.ref-list li')) {
      li.hidden = !li.dataset.name.includes(query);
      resortMatch ||= !li.hidden;
    }
    // Hide headings whose lists are now empty. (A section can legitimately
    // have no list items, only the unnamed-slopes note, so only hide it while searching.)
    const hasVisible = el => !!el.querySelector('li:not([hidden])');
    details.querySelectorAll('.ref-group').forEach(el => { el.hidden = !hasVisible(el); });
    details.querySelectorAll('.ref-section').forEach(el => { el.hidden = !!query && !hasVisible(el); });
    details.querySelectorAll('[data-hide-on-search]').forEach(el => { el.hidden = !!query; });

    details.hidden = !!query && !resortMatch;
    if (query) details.open = resortMatch;
    else if (preSearchOpen) details.open = preSearchOpen.has(details.id);
    anyMatch ||= resortMatch;
  }
  if (!query) preSearchOpen = null;

  main.querySelector('.ref-status').textContent =
    query && !anyMatch ? t('reference.noMatches', { query: raw }) : '';
}

/** Opens the resort a #hash points at, then brings it into view. */
function revealHash() {
  const target = document.getElementById(location.hash.slice(1));
  if (!(target instanceof HTMLDetailsElement)) return;
  target.open = true;
  target.scrollIntoView({ block: 'start' });
}

try {
  const [network, { resorts }] = await Promise.all(
    ['data/network.json', 'data/resorts.json'].map(url => fetch(url).then(r => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.json();
    })),
  );
  reference = buildReference(network, resorts);
} catch (err) {
  console.error('Could not load the lift & slope reference', err);
}

render();
if (location.hash) revealHash();
window.addEventListener('hashchange', revealHash);
window.addEventListener('localechange', render);
