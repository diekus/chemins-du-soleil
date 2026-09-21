/**
 * Minimal i18n layer: flat JSON dictionaries + a t() lookup helper.
 * No framework — locale/{en,fr,es}.json are plain "key": "string" maps.
 * Components re-render on the 'localechange' event dispatched on window
 * (listen in connectedCallback, unlisten in disconnectedCallback, re-render).
 */

export const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'it'];
const DEFAULT_LOCALE = 'en';
const STORAGE_KEY = 'cds:locale';

const dictionaries = new Map(); // locale -> { key: string }

function resolveInitialLocale() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;

  const nav = (navigator.language || '').slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.includes(nav) ? nav : DEFAULT_LOCALE;
}

async function loadDictionary(locale) {
  if (dictionaries.has(locale)) return dictionaries.get(locale);
  const res = await fetch(`locale/${locale}.json`);
  const dict = await res.json();
  dictionaries.set(locale, dict);
  return dict;
}

// Resolved and loaded at module-evaluation time (real top-level await) so
// every module that imports i18n.js — including every Web Component module,
// whose customElements.define() upgrades already-parsed DOM elements as soon
// as it runs — waits for the active dictionary before any component's first
// render. This is what prevents a flash of raw translation keys or English
// text on a French/Spanish first load.
let activeLocale = resolveInitialLocale();
await Promise.all([
  loadDictionary(DEFAULT_LOCALE),
  activeLocale !== DEFAULT_LOCALE ? loadDictionary(activeLocale) : Promise.resolve(),
]);
document.documentElement.lang = activeLocale;

/** Resolves once the active locale's dictionary is loaded (see above) — kept as an explicit, documented entry point for app.js to await before wiring anything locale-dependent. */
export function initLocale() {
  return Promise.resolve();
}

/** Sets the active locale, persists the override, and notifies listeners. */
export async function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale) || locale === activeLocale) return;
  await loadDictionary(locale);
  activeLocale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = activeLocale;
  window.dispatchEvent(new CustomEvent('localechange', { detail: { locale } }));
}

export function getLocale() {
  return activeLocale;
}

function lookup(locale, key) {
  return dictionaries.get(locale)?.[key];
}

/**
 * Translates `key` in the active locale, interpolating `{placeholder}`
 * tokens from `params`. Falls back to the English string if the active
 * locale is missing the key (never to the raw key). When `params.count` is
 * present, tries `${key}_one` (count === 1) / `${key}_other` first, falling
 * back to the bare key if no pluralized variant exists.
 */
export function t(key, params) {
  let resolvedKey = key;
  if (params && typeof params.count === 'number') {
    const suffixed = `${key}_${params.count === 1 ? 'one' : 'other'}`;
    if (lookup(activeLocale, suffixed) !== undefined || lookup(DEFAULT_LOCALE, suffixed) !== undefined) {
      resolvedKey = suffixed;
    }
  }

  const raw = lookup(activeLocale, resolvedKey) ?? lookup(DEFAULT_LOCALE, resolvedKey) ?? resolvedKey;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`));
}
