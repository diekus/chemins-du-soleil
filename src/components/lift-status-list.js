// Mirrors open-piste's Lift.status enum, plus 'unknown' as a safe default.
const STATUS_LABEL = {
  open: 'Open',
  scheduled: 'Scheduled',
  delayed: 'Delayed',
  on_hold: 'On hold',
  closed: 'Closed',
  out_of_period: 'Out of season',
  unknown: 'Unknown',
};

class LiftStatusList extends HTMLElement {
  #lifts        = undefined; // undefined=loading, null=unavailable, array=rendered
  #closuresOnly = false;
  #estimated    = false;

  /**
   * Assign lift status data:
   *   undefined → loading skeleton
   *   null      → "unavailable" state
   *   []        → "no lift data" message
   *   [...]     → [{ name, status }] (status per open-piste's Lift.status enum)
   */
  set lifts(val) {
    this.#lifts = val;
    this.#render();
  }

  /** When true, only lifts that are not open are shown (used by the Alerts view). */
  set closuresOnly(val) {
    this.#closuresOnly = Boolean(val);
    this.#render();
  }

  /**
   * When true, shows a note that this is fallback (not live) data — a
   * hand-maintained example list from data/lift-status.json, not a real
   * status check. The property is named `estimated` for brevity, but the
   * user-facing copy says "Example data" rather than "Estimated" so it
   * doesn't overstate what it actually is.
   */
  set estimated(val) {
    this.#estimated = Boolean(val);
    this.#render();
  }

  connectedCallback() {
    this.#render();
  }

  #render() {
    const lifts = this.#lifts;
    if (lifts === undefined) { this.innerHTML = this.#loadingHTML();     return; }
    if (lifts === null)      { this.innerHTML = this.#unavailableHTML(); return; }

    const visible = this.#closuresOnly ? lifts.filter(l => l.status !== 'open') : lifts;

    if (visible.length === 0) {
      this.innerHTML = this.#emptyHTML();
      return;
    }

    const note = this.#estimated
      ? `<p class="lift-list-provenance">Example data — live status unavailable</p>` : '';
    const rows = visible.map(l => this.#rowHTML(l)).join('');
    this.innerHTML = `${note}<ul class="lift-list" role="list">${rows}</ul>`;
  }

  #rowHTML(lift) {
    const status = STATUS_LABEL[lift.status] ? lift.status : 'unknown';
    return `
      <li class="lift-row">
        <span class="lift-dot" data-status="${status}" aria-hidden="true"></span>
        <span class="lift-name">${lift.name}</span>
        <span class="lift-state" data-status="${status}">${STATUS_LABEL[status]}</span>
      </li>
    `;
  }

  #loadingHTML() {
    return `
      <div class="lift-list-loading" role="status" aria-busy="true" aria-label="Loading lift status…">
        <div class="lift-row-skeleton"></div>
        <div class="lift-row-skeleton"></div>
        <div class="lift-row-skeleton"></div>
      </div>
    `;
  }

  #unavailableHTML() {
    return `<p class="lift-list-empty">Lift status unavailable right now.</p>`;
  }

  #emptyHTML() {
    return `<p class="lift-list-empty">${this.#closuresOnly ? 'No active closures.' : 'No lift data.'}</p>`;
  }
}

customElements.define('lift-status-list', LiftStatusList);
