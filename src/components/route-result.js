const FLAGS = { FR: '🇫🇷', CH: '🇨🇭' };
const COUNTRY_NAME = { FR: 'France', CH: 'Switzerland' };
const STEP_ICON = { lift: '🚡', slope: '⛷️' };

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
    const displaySteps = route.steps.filter((s, i, arr) => {
      if (i === 0) return true;
      const p = arr[i - 1];
      const sCountry = this.#nodes.get(s.from)?.country ?? null;
      const pCountry = this.#nodes.get(p.from)?.country ?? null;
      return !(s.name === p.name && sCountry === pCountry && s.difficulty === p.difficulty);
    });
    const stops = `${displaySteps.length} stop${displaySteps.length !== 1 ? 's' : ''}`;
    const steps = displaySteps.map(s => this.#stepHTML(s)).join('');

    const prefBadge = (this.#preferDifficulty && route.preferenceScore > 0)
      ? `<span class="route-pref-badge" aria-label="${route.preferenceScore} ${this.#preferDifficulty} steps">
           <span class="diff-dot" data-d="${this.#preferDifficulty}" aria-hidden="true"></span>
           ${route.preferenceScore} ${this.#preferDifficulty}
         </span>`
      : '';

    return `
      <li class="route-card">
        <div class="route-card-header">
          <span class="route-label">${label}</span>
          ${prefBadge}
          <span class="route-stops" aria-label="${route.steps.length} stops">${stops}</span>
        </div>
        <ol class="route-steps" aria-label="${label}">${steps}</ol>
      </li>
    `;
  }

  #stepHTML(step) {
    const country   = this.#nodes.get(step.from)?.country ?? null;
    const flag      = country ? FLAGS[country] ?? '' : '';
    const flagLabel = country ? COUNTRY_NAME[country] ?? '' : '';
    const icon      = STEP_ICON[step.type] ?? '•';

    // Difficulty dot only shown for slopes — lifts have no piste colour.
    const diffDot = step.type === 'slope'
      ? `<span class="diff-dot" data-d="${step.difficulty}" role="img" aria-label="${step.difficulty} slope"></span>`
      : `<span class="diff-dot diff-dot--lift" aria-hidden="true"></span>`;

    return `
      <li class="route-step">
        <span class="step-icon" aria-hidden="true">${icon}</span>
        <span class="step-name">${step.name}</span>
        <span class="step-flag" aria-label="${flagLabel}">${flag}</span>
        ${diffDot}
      </li>
    `;
  }

  #loadingHTML() {
    return `
      <div class="loading-cards" aria-busy="true" aria-label="Finding routes…">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    `;
  }

  #noRouteHTML() {
    return `
      <div class="no-route" role="status">
        <span class="no-route-icon" aria-hidden="true">⛷️</span>
        <p class="no-route-title">No route found</p>
        <p>There is no path between these stations at the chosen difficulty.
           Try raising the maximum difficulty.</p>
      </div>
    `;
  }
}

customElements.define('route-result', RouteResult);
