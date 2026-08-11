import { FLAGS } from '../countries.js';

let _uid = 0;

class StationInput extends HTMLElement {
  #stations  = [];
  #filtered  = [];
  #activeIdx = -1;
  #selectedId = null;
  #lbId;

  constructor() {
    super();
    this.#lbId = `si-lb-${++_uid}`;
  }

  connectedCallback() {
    const placeholder = this.getAttribute('placeholder') ?? 'Search stations…';
    const labelledBy  = this.getAttribute('aria-labelledby') ?? '';

    this.innerHTML = `
      <input
        class="si-input"
        type="text"
        role="combobox"
        aria-expanded="false"
        aria-autocomplete="list"
        aria-controls="${this.#lbId}"
        ${labelledBy ? `aria-labelledby="${labelledBy}"` : ''}
        autocomplete="off"
        spellcheck="false"
        placeholder="${placeholder}"
      >
      <ul id="${this.#lbId}" class="si-listbox" role="listbox" hidden></ul>
    `;

    this.#el.addEventListener('input',   ()  => this.#onInput());
    this.#el.addEventListener('keydown', e   => this.#onKeydown(e));
    this.#el.addEventListener('blur',    ()  => this.#close());
    this.#lb.addEventListener('mousedown', e => {
      // Prevent blur from firing before we can register the click.
      e.preventDefault();
      const opt = e.target.closest('[role="option"]');
      if (opt) this.#commit(opt);
    });
  }

  /** Array of { id, name, country } — set by app.js after data load. */
  set stations(list) {
    this.#stations = list ?? [];
  }

  /** The selected node ID, or null if nothing is selected. */
  get value() {
    return this.#selectedId;
  }

  get #el() { return this.querySelector('.si-input'); }
  get #lb() { return this.querySelector('.si-listbox'); }

  // ── Private ──────────────────────────────────────────────────────────────

  #onInput() {
    const q = this.#el.value.trim().toLowerCase();
    this.#selectedId = null;
    this.#filtered   = q.length > 0
      ? this.#stations.filter(s => s.name.toLowerCase().includes(q))
      : [];
    this.#activeIdx = -1;
    this.#paint();
  }

  #onKeydown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (this.#lb.hidden && this.#el.value.trim()) this.#paint();
        this.#shift(+1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.#shift(-1);
        break;
      case 'Enter':
        e.preventDefault();
        if (!this.#lb.hidden) {
          const active = this.#lb.querySelector('[aria-selected="true"]');
          if (active) this.#commit(active);
        }
        break;
      case 'Escape':
        this.#close();
        break;
      // Tab: let default focus move happen, but close the list first.
      case 'Tab':
        this.#close();
        break;
    }
  }

  #shift(dir) {
    if (this.#filtered.length === 0) return;
    this.#activeIdx = Math.max(0, Math.min(this.#filtered.length - 1, this.#activeIdx + dir));
    this.#highlight();
  }

  #paint() {
    const lb = this.#lb;
    if (this.#filtered.length === 0) {
      this.#setExpanded(false);
      lb.innerHTML = '';
      lb.hidden = true;
      return;
    }

    lb.innerHTML = this.#filtered.map((s, i) => `
      <li
        id="${this.#lbId}-${i}"
        class="si-option"
        role="option"
        aria-selected="false"
        data-id="${s.id}"
      >
        <span aria-hidden="true">${FLAGS[s.country] ?? ''}</span>
        ${s.name}
      </li>
    `).join('');

    lb.hidden = false;
    this.#setExpanded(true);
    this.#highlight();
  }

  #highlight() {
    const opts = [...this.#lb.querySelectorAll('[role="option"]')];
    opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === this.#activeIdx)));
    const current = opts[this.#activeIdx];
    if (current) {
      this.#el.setAttribute('aria-activedescendant', current.id);
      current.scrollIntoView({ block: 'nearest' });
    }
  }

  #commit(optEl) {
    const station = this.#filtered.find(s => s.id === optEl.dataset.id);
    if (!station) return;
    this.#selectedId  = station.id;
    this.#el.value    = `${FLAGS[station.country] ?? ''} ${station.name}`;
    this.#close();
    this.dispatchEvent(new CustomEvent('change', {
      detail: { id: station.id, station },
      bubbles: true,
    }));
  }

  #close() {
    this.#lb.hidden   = true;
    this.#lb.innerHTML = '';
    this.#activeIdx   = -1;
    this.#setExpanded(false);
  }

  #setExpanded(val) {
    this.#el.setAttribute('aria-expanded', String(val));
    if (!val) this.#el.removeAttribute('aria-activedescendant');
  }
}

customElements.define('station-input', StationInput);
