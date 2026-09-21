import { ICONS } from '../icons.js';
import { dedupeSteps, stepHTML, prefBadgeHTML } from '../route-view.js';

class RouteResult extends HTMLElement {
  #routes           = undefined; // undefined=idle, null=loading, []=no route, [...]=results
  #nodes            = new Map();
  #preferDifficulty = null;

  /** Pass the nodeMap (Map<id, node>) so country flags can be resolved. */
  set nodes(map) {
    this.#nodes = map instanceof Map ? map : new Map();
  }

  /** Pass the active preferred difficulty (string or null) for badge labelling. */
  set preferDifficulty(val) {
    this.#preferDifficulty = val || null;
  }

  /**
   * Assign route results:
   *   undefined  → idle (nothing rendered)
   *   null       → loading skeleton
   *   []         → no-route message
   *   Route[]    → stacked cards
   */
  set routes(val) {
    this.#routes = val;
    this.#render();
  }

  connectedCallback() {
    this.addEventListener('click', e => {
      const btn = e.target.closest('.route-card-btn');
      if (!btn) return;
      this.dispatchEvent(new CustomEvent('routeselect', {
        detail:  { index: Number(btn.dataset.index) },
        bubbles: true,
      }));
    });
  }

  #render() {
    const r = this.#routes;
    if (r === undefined)      { this.innerHTML = '';                  return; }
    if (r === null)           { this.innerHTML = this.#loadingHTML(); return; }
    if (r.length === 0)       { this.innerHTML = this.#noRouteHTML(); return; }
    this.innerHTML = this.#cardsHTML(r);
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  #cardsHTML(routes) {
    const cards = routes.map((route, i) => this.#cardHTML(route, i)).join('');
    return `<ul class="result-cards" role="list">${cards}</ul>`;
  }

  #cardHTML(route, index) {
    const label = index === 0 ? 'Best route' : `Alternative ${index + 1}`;
    const displaySteps = dedupeSteps(route.steps, this.#nodes);
    const stops = `${displaySteps.length} stop${displaySteps.length !== 1 ? 's' : ''}`;
    const steps = displaySteps.map(s => stepHTML(s, this.#nodes)).join('');

    // Counted from displaySteps (not route.preferenceScore) so the badge matches
    // what's actually visible — a single piste split into several graph edges by
    // routing junctions collapses to one displayed row and must count as one.
    const prefCount = this.#preferDifficulty
      ? displaySteps.filter(s => s.difficulty === this.#preferDifficulty).length
      : 0;

    const prefBadge = prefBadgeHTML(this.#preferDifficulty, prefCount);

    return `
      <li class="route-card">
        <button type="button" class="route-card-btn" data-index="${index}" aria-label="${label}, ${stops} — view full details">
          <span class="route-card-header">
            <span class="route-label">${label}</span>
            ${prefBadge}
            <span class="route-stops" aria-label="${route.steps.length} stops">${stops}</span>
          </span>
          <ol class="route-steps" aria-label="${label}">${steps}</ol>
        </button>
      </li>
    `;
  }

  #loadingHTML() {
    return `
      <div class="loading-cards" role="status" aria-busy="true" aria-label="Finding routes…">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    `;
  }

  #noRouteHTML() {
    return `
      <div class="no-route" role="status">
        <span class="no-route-icon" aria-hidden="true">${ICONS.ski}</span>
        <p class="no-route-title">No route found</p>
        <p>There is no path between these stations at the chosen difficulty.
           Try raising the maximum difficulty.</p>
      </div>
    `;
  }
}

customElements.define('route-result', RouteResult);
