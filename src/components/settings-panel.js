import { t, getLocale, setLocale, SUPPORTED_LOCALES } from '../i18n.js';
import { getTheme, setTheme, THEMES } from '../theme.js';

let _uid = 0;

// Each language's own name, in its own language — never translated per the
// active locale, so a French speaker can always find "Français" regardless
// of what's currently selected.
const LANGUAGE_NAMES = { en: 'English', fr: 'Français', es: 'Español', it: 'Italiano' };

// Web Install API (navigator.install). Only offered where the browser
// supports it, and hidden when we're already running as the installed app.
const INSTALL_SUPPORTED = typeof navigator.install === 'function';
const installedDisplay = matchMedia('(display-mode: standalone), (display-mode: window-controls-overlay)');

class SettingsPanel extends HTMLElement {
  #idPrefix;
  // 'idle' | 'pending' | 'installed' | 'error'; survives locale re-renders.
  #installState = 'idle';
  #onLocaleChange = () => this.#render();
  #onDisplayChange = () => this.#render();

  constructor() {
    super();
    this.#idPrefix = `set-${++_uid}`;
  }

  connectedCallback() {
    this.#render();
    window.addEventListener('localechange', this.#onLocaleChange);
    installedDisplay.addEventListener('change', this.#onDisplayChange);
  }

  disconnectedCallback() {
    window.removeEventListener('localechange', this.#onLocaleChange);
    installedDisplay.removeEventListener('change', this.#onDisplayChange);
  }

  #render() {
    const id = this.#idPrefix;
    const currentLocale = getLocale();
    const langOpts = SUPPORTED_LOCALES.map(code =>
      `<option value="${code}"${code === currentLocale ? ' selected' : ''}>${LANGUAGE_NAMES[code]}</option>`
    ).join('');

    const currentTheme = getTheme();
    const themeOpts = THEMES.map(theme =>
      `<option value="${theme}"${theme === currentTheme ? ' selected' : ''}>${t(`settings.theme.${theme}`)}</option>`
    ).join('');

    const showInstall = INSTALL_SUPPORTED && !installedDisplay.matches;
    const installStatus = {
      installed: t('settings.installSuccess'),
      error: t('settings.installError'),
    }[this.#installState] ?? '';

    this.innerHTML = `
      <h2 class="section-label">${t('settings.title')}</h2>
      <div class="settings-list">
        <div class="form-row">
          <label id="${id}-lang-lbl">${t('settings.languageLabel')}</label>
          <select id="${id}-lang" data-setting="locale" aria-labelledby="${id}-lang-lbl">${langOpts}</select>
        </div>
        <div class="form-row">
          <label id="${id}-theme-lbl">${t('settings.themeLabel')}</label>
          <select id="${id}-theme" data-setting="theme" aria-labelledby="${id}-theme-lbl">${themeOpts}</select>
        </div>
        ${showInstall ? `
        <div class="form-row settings-install">
          <span class="form-row-label">${t('settings.installLabel')}</span>
          <p class="settings-hint" id="${id}-install-hint">${t('settings.installHint')}</p>
          <button type="button" class="btn-find" data-action="install"
            aria-describedby="${id}-install-hint"
            ${this.#installState === 'pending' ? 'disabled aria-busy="true"' : ''}>${t('settings.installButton')}</button>
          <p class="settings-status" role="status" aria-live="polite">${installStatus}</p>
        </div>` : ''}
      </div>
    `;

    this.querySelector('[data-setting="locale"]').addEventListener('change', e => {
      setLocale(e.target.value);
    });
    this.querySelector('[data-setting="theme"]').addEventListener('change', e => {
      setTheme(e.target.value);
    });
    this.querySelector('[data-action="install"]')?.addEventListener('click', () => this.#install());
  }

  async #install() {
    this.#installState = 'pending';
    this.#render();
    try {
      await navigator.install();
      this.#installState = 'installed';
    } catch (err) {
      // AbortError: the user dismissed the browser's install prompt, which
      // isn't a failure worth announcing.
      this.#installState = err?.name === 'AbortError' ? 'idle' : 'error';
    }
    this.#render();
    // Re-rendering replaced the focused button; restore focus unless the
    // user has already moved on elsewhere.
    if (document.activeElement === document.body) {
      this.querySelector('[data-action="install"]')?.focus();
    }
  }
}

customElements.define('settings-panel', SettingsPanel);
