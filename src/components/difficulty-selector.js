let _uid = 0;

const OPTIONS = [
  { value: 'green', label: 'Green — Easy only' },
  { value: 'blue',  label: 'Blue — Up to blue' },
  { value: 'red',   label: 'Red — Up to red' },
  { value: 'black', label: 'Black — Any difficulty' },
];

class DifficultySelector extends HTMLElement {
  #selectId;

  constructor() {
    super();
    this.#selectId = `ds-sel-${++_uid}`;
  }

  connectedCallback() {
    const labelledBy = this.getAttribute('aria-labelledby') ?? '';
    const opts = OPTIONS.map(o =>
      `<option value="${o.value}"${o.value === 'black' ? ' selected' : ''}>${o.label}</option>`
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
