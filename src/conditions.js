const OPEN_PISTE_BASE = 'https://open-piste.raed.workers.dev';

/** Fetch a resort's open-piste record. Throws on a network or non-OK response. */
export async function fetchOpenPiste(slug) {
  const res = await fetch(`${OPEN_PISTE_BASE}/resorts/${slug}`);
  if (!res.ok) throw new Error(`open-piste request failed: ${res.status}`);
  return res.json();
}

/**
 * Merge a live open-piste record with static fallback data, field by field.
 * `openPiste` may be `{}` (e.g. after a failed fetch) — every field then
 * falls back to the static data.
 *
 * Returns:
 *   avalanche: null | { level, sector, note, live }
 *   lifts:     null | [{ name, status }]
 *   liftsLive: boolean
 */
export function mergeConditions(openPiste, staticAvalanche, staticLifts) {
  const weather = openPiste?.weather ?? {};

  const liveLevel = weather.avalanche_risk;
  const level = liveLevel ?? staticAvalanche?.level ?? null;
  const avalanche = level == null ? null : {
    level,
    sector: staticAvalanche?.sector ?? null,
    note:   staticAvalanche?.note ?? null,
    live:   liveLevel != null,
  };

  const liveLifts = Array.isArray(openPiste?.lifts) ? openPiste.lifts : [];
  const liftsLive = liveLifts.length > 0;
  const lifts = liftsLive
    ? liveLifts.map(l => ({ name: l.name, status: l.status }))
    : (staticLifts ?? null);

  return { avalanche, lifts, liftsLive };
}
