import { t } from '../i18n.js';

let _uid = 0;

const OPTIONS = [
  { value: '',      key: 'preference.none' },
  { value: 'green', key: 'preference.green' },
  { value: 'blue',  key: 'preference.blue' },
  { value: 'red',   key: 'preference.red' },
  { value: 'black', key: 'preference.black' },
];

class PreferenceSelector extends HTMLElement {
  #selectId;
  #onLocaleChange = () => this.#render();

  constructor() {
    super();
    this.#selectId = `ps-sel-${++_uid}`;
  }

  connectedCallback() {
    this.#render();
    window.addEventListener('localechange', this.#onLocaleChange);
  }

  disconnectedCallback() {
    window.removeEventListener('localechange', this.#onLocaleChange);
  }

  #render() {
    const current = this.querySelector('select')?.value ?? '';
    const labelledBy = this.getAttribute('aria-labelledby') ?? '';
    const opts = OPTIONS.map(o =>
      `<option value="${o.value}"${o.value === current ? ' selected' : ''}>${t(o.key)}</option>`
    ).join('');

    this.innerHTML = `
      <select
        id="${this.#selectId}"
        ${labelledBy ? `aria-labelledby="${labelledBy}"` : ''}
      >${opts}</select>
    `;

    this.querySelector('select').addEventListener('change', e => {
      this.dispatchEvent(new CustomEvent('change', {
        detail: { value: e.target.value },
        bubbles: true,
      }));
    });
  }

  get value() {
    return this.querySelector('select')?.value ?? '';
  }
}

customElements.define('preference-selector', PreferenceSelector);
