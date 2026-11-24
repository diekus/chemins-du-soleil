// Anonymous, cookieless usage counting via GoatCounter (goatcounter.com).
//
// GoatCounter sets no cookies and stores nothing on the device; it counts
// unique visits from a server-side hash of IP + User-Agent whose salt rotates
// daily, and derives the country from the IP without keeping it. That's why
// no consent banner is needed — see privacy.html "Anonymous usage statistics".
//
// Never send anything personal through here: no coordinates, no meet-up link
// parameters, nothing typed by the user. Paths and event names are fixed
// strings; titles are at most lift/village names from network.json.
//
// GoatCounter's auto-count is disabled because the app routes by hash
// (#resorts, #route?...), which it ignores — app.js reports views itself.

const ENDPOINT = 'https://chemins-soleil.goatcounter.com/count';
const SCRIPT   = 'https://gc.zgo.at/count.js';

// Honour Do Not Track / Global Privacy Control, even though nothing here
// identifies anyone.
const OPTED_OUT = navigator.doNotTrack === '1'
  || window.doNotTrack === '1'
  || navigator.globalPrivacyControl === true;

const queue = [];
let ready = false;

function send(vars) {
  if (OPTED_OUT) return;
  if (!ready) { queue.push(vars); return; }
  try {
    window.goatcounter.count(vars);
  } catch {
    // Analytics must never break the app.
  }
}

if (!OPTED_OUT) {
  window.goatcounter = { no_onload: true, endpoint: ENDPOINT };
  const s = document.createElement('script');
  s.async = true;
  s.src = SCRIPT;
  s.dataset.goatcounter = ENDPOINT;
  s.addEventListener('load', () => {
    ready = true;
    for (const vars of queue.splice(0)) send(vars);
  });
  // Offline / blocked: drop silently, keep nothing queued forever.
  s.addEventListener('error', () => { queue.length = 0; });
  document.head.append(s);
}

/** Records a page view. `path` is a fixed, non-personal path such as "/resorts". */
export function trackView(path, title = document.title) {
  send({ path, title });
}

/** Records an event, e.g. trackEvent('search-route', 'Pléney → Chavannes'). */
export function trackEvent(name, title = name) {
  send({ path: name, title, event: true });
}
