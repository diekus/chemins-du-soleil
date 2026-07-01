let _uid = 0;

const OPTIONS = [
  { value: '',      label: 'No preference' },
  { value: 'green', label: 'Prefer green' },
  { value: 'blue',  label: 'Prefer blue' },
  { value: 'red',   label: 'Prefer red' },
  { value: 'black', label: 'Prefer black' },
];

class PreferenceSelector extends HTMLElement {
  #selectId;

  constructor() {
    super();
    this.#selectId = `ps-sel-${++_uid}`;
  }

  connectedCallback() {
    const labelledBy = this.getAttribute('aria-labelledby') ?? '';
    const opts = OPTIONS.map(o =>
      `<option value="${o.value}">${o.label}</option>`
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
