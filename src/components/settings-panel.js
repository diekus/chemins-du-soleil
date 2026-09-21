import { t, getLocale, setLocale, SUPPORTED_LOCALES } from '../i18n.js';

let _uid = 0;

// Each language's own name, in its own language — never translated per the
// active locale, so a French speaker can always find "Français" regardless
// of what's currently selected.
const LANGUAGE_NAMES = { en: 'English', fr: 'Français', es: 'Español', it: 'Italiano' };

class SettingsPanel extends HTMLElement {
  #selectId;
  #onLocaleChange = () => this.#render();

  constructor() {
    super();
    this.#selectId = `set-lang-${++_uid}`;
  }

  connectedCallback() {
    this.#render();
    window.addEventListener('localechange', this.#onLocaleChange);
  }

  disconnectedCallback() {
    window.removeEventListener('localechange', this.#onLocaleChange);
  }

  #render() {
    const current = getLocale();
    const opts = SUPPORTED_LOCALES.map(code =>
      `<option value="${code}"${code === current ? ' selected' : ''}>${LANGUAGE_NAMES[code]}</option>`
    ).join('');

    this.innerHTML = `
      <h2 class="section-label">${t('settings.title')}</h2>
      <div class="form-row">
        <label id="${this.#selectId}-lbl">${t('settings.languageLabel')}</label>
        <select id="${this.#selectId}" aria-labelledby="${this.#selectId}-lbl">${opts}</select>
      </div>
    `;

    this.querySelector('select').addEventListener('change', e => {
      setLocale(e.target.value);
    });
  }
}

customElements.define('settings-panel', SettingsPanel);
