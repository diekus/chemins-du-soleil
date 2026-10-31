// Install instructions page (setup.html): one collapsible <details> section
// per platform, a jump list at the top, and a language picker. Rendered from
// the same locale dictionaries as the app; re-renders on 'localechange'.

import { t, getLocale, setLocale, SUPPORTED_LOCALES, LANGUAGE_NAMES } from './i18n.js';
import './theme.js';
import { ICONS } from './icons.js';

const APP_URL = 'https://chemins-du-soleil.diek.us/';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=us.diek.chemins';
// No hl/gl params, so the Store picks the visitor's own language and region.
const MS_STORE_URL = 'https://apps.microsoft.com/detail/9ngl1nvx198x';

// Platform and browser names are proper nouns, so they aren't translated.
const PLATFORMS = [
  { id: 'web',      name: 'Web' },
  { id: 'android',  name: 'Android' },
  { id: 'windows',  name: 'Windows' },
  { id: 'macos',    name: 'macOS' },
  { id: 'linux',    name: 'Linux' },
  { id: 'ios',      name: 'iOS & iPadOS' },
  { id: 'chromeos', name: 'ChromeOS' },
];

/** Best guess at the visitor's platform, used to open and mark their section. */
function detectPlatform() {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh/.test(ua)) return 'macos';
  if (/Linux/.test(ua)) return 'linux';
  return 'web';
}

const DETECTED = detectPlatform();

// ── Markup helpers ───────────────────────────────────────────────────────────
// A UI label (menu item, button) as the user will see it on screen.
const ui = key => `<strong>${t(`setup.ui.${key}`)}</strong>`;
const appLink = () => `<a href="${APP_URL}">${new URL(APP_URL).host}</a>`;
const steps = (...items) => `<ol class="setup-steps">${items.map(i => `<li>${i}</li>`).join('')}</ol>`;
const heading = text => `<h3>${text}</h3>`;
const note = html => `<p class="setup-note">${html}</p>`;
const storeLink = (href, key) =>
  `<a class="btn-find" href="${href}" target="_blank" rel="noopener">${t(key)}</a>`;
const open = browser => t('setup.step.open', { url: appLink(), browser });

// Chrome/Edge on desktop: the install icon ("ambient badge") in the address bar.
function chromiumDesktop({ title = 'Chrome & Edge', browser = 'Chrome / Edge', edge = true } = {}) {
  return heading(title)
    + steps(
      open(browser),
      t('setup.step.ambientBadge'),
      t('setup.step.confirm', { install: ui('install') }),
      t('setup.step.done'),
    )
    + note(t('setup.note.chromeMenu', { path: ui('chromeMenuPath') })
      + (edge ? ` ${t('setup.note.edgeMenu', { path: ui('edgeMenuPath') })}` : ''));
}

const BODIES = {
  web: () =>
    `<p>${t('setup.web.intro')}</p>`
    + steps(
      t('setup.web.step1', { url: appLink() }),
      t('setup.web.step2'),
      t('setup.web.step3'),
    ),

  android: () =>
    `<p>${t('setup.android.store')}</p>`
    + storeLink(PLAY_STORE_URL, 'setup.android.storeButton')
    + heading(t('setup.orBrowser'))
    + steps(
      open('Chrome / Edge'),
      t('setup.android.banner', { install: ui('installApp') }),
      t('setup.android.menu', { add: ui('androidAddHome'), install: ui('install') }),
    )
    + note(t('setup.android.firefox', { add: ui('firefoxAndroid') })),

  windows: () =>
    `<p>${t('setup.windows.store')}</p>`
    + storeLink(MS_STORE_URL, 'setup.windows.storeButton')
    + heading(t('setup.orBrowser'))
    + chromiumDesktop()
    + heading('Firefox')
    + steps(
      open('Firefox'),
      t('setup.windows.firefox', { label: ui('firefoxTaskbar') }),
      t('setup.step.done'),
    ),

  macos: () =>
    chromiumDesktop()
    + heading('Safari')
    + steps(
      open('Safari'),
      t('setup.macos.safari', { path: ui('safariDock'), add: ui('add') }),
      t('setup.step.done'),
    )
    + heading('Firefox')
    + note(t('setup.note.firefox', { platform: 'macOS' })),

  linux: () =>
    chromiumDesktop({ title: 'Chrome, Edge & Chromium', browser: 'Chrome / Edge / Chromium' })
    + heading('Firefox')
    + note(t('setup.note.firefox', { platform: 'Linux' })),

  ios: () =>
    steps(
      t('setup.ios.step1', { url: appLink() }),
      t('setup.ios.step2', { share: ui('share') }),
      t('setup.ios.step3', { add: ui('addHome') }),
      t('setup.ios.step4', { webApp: ui('webApp'), add: ui('add') }),
      t('setup.ios.step5'),
    )
    + note(t('setup.ios.otherBrowsers')),

  chromeos: () => chromiumDesktop({ title: 'Chrome', browser: 'Chrome', edge: false }),
};

// ── Rendering ────────────────────────────────────────────────────────────────
const main = document.getElementById('setup');

function render() {
  // Keep whichever sections the visitor had open across a language switch.
  const wasOpen = new Set([...main.querySelectorAll('details[open]')].map(d => d.id));
  const firstRender = !main.hasChildNodes();
  const hashTarget = location.hash.slice(1);
  const isOpen = id => firstRender
    ? id === (PLATFORMS.some(p => p.id === hashTarget) ? hashTarget : DETECTED)
    : wasOpen.has(id);

  const current = getLocale();
  const langOpts = SUPPORTED_LOCALES.map(code =>
    `<option value="${code}"${code === current ? ' selected' : ''}>${LANGUAGE_NAMES[code]}</option>`
  ).join('');

  const badge = id => id === DETECTED ? `<span class="setup-device-badge">${t('setup.yourDevice')}</span>` : '';

  main.innerHTML = `
    <p class="back-link"><a href="index.html">&larr; ${t('setup.back')}</a></p>

    <div>
      <h1 class="section-label">${t('setup.title')}</h1>
      <p class="setup-intro">${t('setup.intro')}</p>
    </div>

    <div class="form-row setup-lang">
      <label for="setup-lang">${t('settings.languageLabel')}</label>
      <select id="setup-lang">${langOpts}</select>
    </div>

    <nav class="setup-jump" aria-labelledby="setup-jump-lbl">
      <h2 class="section-label" id="setup-jump-lbl">${t('setup.jumpLabel')}</h2>
      <ul>
        ${PLATFORMS.map(p => `
          <li><a href="#${p.id}"${p.id === DETECTED ? ` class="is-current" aria-description="${t('setup.yourDevice')}"` : ''}>${p.name}</a></li>
        `).join('')}
      </ul>
    </nav>

    <div class="setup-platforms">
      ${PLATFORMS.map(p => `
        <details class="setup-platform" id="${p.id}"${isOpen(p.id) ? ' open' : ''}>
          <summary>
            <h2>${p.name}</h2>
            ${badge(p.id)}
            <span class="chevron" aria-hidden="true">${ICONS.chevronDown}</span>
          </summary>
          <div class="setup-body">${BODIES[p.id]()}</div>
        </details>
      `).join('')}
    </div>
  `;

  main.querySelector('#setup-lang').addEventListener('change', e => setLocale(e.target.value));

  document.title = `${t('setup.title')} — ${t('app.title')}`;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
}

/** Opens the section a #hash points at, then brings it into view. */
function revealHash() {
  const target = document.getElementById(location.hash.slice(1));
  if (!(target instanceof HTMLDetailsElement)) return;
  target.open = true;
  target.scrollIntoView({ block: 'start' });
}

render();
if (location.hash) revealHash();

// Jump links: open the section even when its hash is already in the URL
// (clicking the same link twice doesn't fire hashchange).
main.addEventListener('click', e => {
  const link = e.target.closest('.setup-jump a');
  if (!link) return;
  const target = document.getElementById(link.hash.slice(1));
  if (target instanceof HTMLDetailsElement) target.open = true;
});
window.addEventListener('hashchange', revealHash);
window.addEventListener('localechange', render);
