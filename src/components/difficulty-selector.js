import { t } from '../i18n.js';

let _uid = 0;

const OPTIONS = [
  { value: 'green', key: 'difficulty.optionGreen' },
  { value: 'blue',  key: 'difficulty.optionBlue' },
  { value: 'red',   key: 'difficulty.optionRed' },
  { value: 'black', key: 'difficulty.optionBlack' },
];

class DifficultySelector extends HTMLElement {
  #selectId;
  #onLocaleChange = () => this.#render();

  constructor() {
    super();
    this.#selectId = `ds-sel-${++_uid}`;
  }

  connectedCallback() {
    this.#render();
    window.addEventListener('localechange', this.#onLocaleChange);
  }

  disconnectedCallback() {
    window.removeEventListener('localechange', this.#onLocaleChange);
  }

  #render() {
    const current = this.querySelector('select')?.value ?? 'black';
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
    return this.querySelector('select')?.value ?? 'black';
  }
}

customElements.define('difficulty-selector', DifficultySelector);
