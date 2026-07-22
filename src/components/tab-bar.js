const TABS = [
  { view: 'home',   label: 'Home',   icon: '🏠' },
  { view: 'lifts',  label: 'Lifts',  icon: '🚡' },
  { view: 'alerts', label: 'Alerts', icon: '⚠️' },
];

class TabBar extends HTMLElement {
  #active          = 'home';
  #alertsAvailable = true;

  connectedCallback() {
    this.setAttribute('role', 'tablist');
    this.setAttribute('aria-label', 'Main navigation');
    this.#render();

    this.addEventListener('click', e => {
      const btn = e.target.closest('.tab-bar-item');
      if (!btn) return;
      this.active = btn.dataset.view;
      this.dispatchEvent(new CustomEvent('change', {
        detail: { view: this.#active },
        bubbles: true,
      }));
    });
  }

  /** The currently active view name ('home' | 'lifts' | 'alerts'). */
  get active() { return this.#active; }

  /** Set the active tab's visual state without dispatching 'change'. */
  set active(view) {
    if (!TABS.some(t => t.view === view)) return;
    this.#active = view;
    this.querySelectorAll('.tab-bar-item').forEach(btn => {
      btn.setAttribute('aria-selected', String(btn.dataset.view === view));
    });
  }

  /** When false, the Alerts tab is removed from the bar entirely (nothing to alert about). */
  set alertsAvailable(val) {
    this.#alertsAvailable = Boolean(val);
    this.#render();
  }

  #render() {
    const tabs = TABS.filter(t => t.view !== 'alerts' || this.#alertsAvailable);
    this.innerHTML = tabs.map(t => `
      <button
        id="tab-${t.view}"
        class="tab-bar-item"
        type="button"
        role="tab"
        data-view="${t.view}"
        aria-selected="${t.view === this.#active}"
        aria-controls="view-${t.view}"
      >
        <span class="tab-bar-icon" aria-hidden="true">${t.icon}</span>
        <span class="tab-bar-label">${t.label}</span>
      </button>
    `).join('');
  }
}

customElements.define('tab-bar', TabBar);
