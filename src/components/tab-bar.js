import { ICONS } from '../icons.js';
import { t } from '../i18n.js';

const TABS = [
  { view: 'home',     labelKey: 'tabs.home',     icon: ICONS.home },
  { view: 'resorts',  labelKey: 'tabs.resorts',  icon: ICONS.resorts },
  { view: 'alerts',   labelKey: 'tabs.alerts',   icon: ICONS.alerts },
  { view: 'settings', labelKey: 'tabs.settings', icon: ICONS.settings },
];

class TabBar extends HTMLElement {
  #active          = 'home';
  #alertsAvailable = true;
  #onLocaleChange  = () => this.#render();

  connectedCallback() {
    this.setAttribute('role', 'tablist');
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

    window.addEventListener('localechange', this.#onLocaleChange);
  }

  disconnectedCallback() {
    window.removeEventListener('localechange', this.#onLocaleChange);
  }

  /** The currently active view name ('home' | 'resorts' | 'alerts' | 'settings'). */
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
    this.setAttribute('aria-label', t('tabs.ariaLabel'));
    const tabs = TABS.filter(tb => tb.view !== 'alerts' || this.#alertsAvailable);
    this.innerHTML = tabs.map(tb => `
      <button
        id="tab-${tb.view}"
        class="tab-bar-item"
        type="button"
        role="tab"
        data-view="${tb.view}"
        aria-selected="${tb.view === this.#active}"
        aria-controls="view-${tb.view}"
      >
        <span class="tab-bar-icon" aria-hidden="true">${tb.icon}</span>
        <span class="tab-bar-label">${t(tb.labelKey)}</span>
      </button>
    `).join('');
  }
}

customElements.define('tab-bar', TabBar);
