// Colour-scheme preference: 'system' follows prefers-color-scheme, 'light' /
// 'dark' force a scheme via [data-theme] on <html> (see base.css). The inline
// script in index.html's <head> applies the stored choice before first paint;
// this module owns changing it at runtime.

export const THEMES = ['system', 'light', 'dark'];
const STORAGE_KEY = 'cds:theme';
const systemDark = matchMedia('(prefers-color-scheme: dark)');

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

let activeTheme = readStored();

export function getTheme() {
  return activeTheme;
}

export function isDark() {
  return activeTheme === 'dark' || (activeTheme === 'system' && systemDark.matches);
}

// Elements whose `media` attribute picks a light/dark variant (the theme-color
// metas, the header logo's <source>) carry data-scheme="light|dark". With a
// forced theme their media query is swapped for one that always/never matches.
function applySchemeMedia() {
  for (const el of document.querySelectorAll('[data-scheme]')) {
    const scheme = el.dataset.scheme;
    el.media = activeTheme === 'system'
      ? `(prefers-color-scheme: ${scheme})`
      : (activeTheme === scheme ? 'all' : 'not all');
  }
}

function apply() {
  if (activeTheme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = activeTheme;
  applySchemeMedia();
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  activeTheme = theme;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* private mode */ }
  apply();
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme, dark: isDark() } }));
}

// The OS scheme can flip while 'system' is selected (e.g. auto dark at dusk).
systemDark.addEventListener('change', () => {
  if (activeTheme === 'system') {
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'system', dark: isDark() } }));
  }
});

apply();
