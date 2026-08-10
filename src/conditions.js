const OPEN_PISTE_BASE = 'https://open-piste.raed.workers.dev';

/** Fetch a resort's open-piste record. Throws on a network or non-OK response. */
export async function fetchOpenPiste(slug) {
  const res = await fetch(`${OPEN_PISTE_BASE}/resorts/${slug}`);
  if (!res.ok) throw new Error(`open-piste request failed: ${res.status}`);
  return res.json();
}

/**
 * Read the live avalanche risk out of an open-piste record.
 * `openPiste` may be `{}` (e.g. after a failed fetch) — there's then no
 * reading to report, not a fabricated one.
 *
 * Returns:
 *   avalanche: null | { level }
 */
export function readAvalanche(openPiste) {
  const level = openPiste?.weather?.avalanche_risk ?? null;
  return { avalanche: level == null ? null : { level } };
}
