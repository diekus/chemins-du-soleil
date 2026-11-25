/**
 * Pure route-step helpers (no DOM, i18n or storage), shared by the route
 * views via route-view.js and unit-tested directly in steps.test.js.
 */

/**
 * Collapses consecutive steps that are actually the same piste split by a
 * routing junction. A merged step keeps its first `from` and takes the last
 * piece's `to`, so it spans the whole piste (needed for its vertical change).
 */
export function dedupeSteps(steps, nodes) {
  const out = [];
  for (const s of steps) {
    const p = out[out.length - 1];
    const sCountry = nodes.get(s.from)?.country ?? null;
    const pCountry = p ? nodes.get(p.from)?.country ?? null : null;
    if (p && s.name === p.name && sCountry === pCountry && s.difficulty === p.difficulty) {
      out[out.length - 1] = { ...p, to: s.to };
    } else {
      out.push(s);
    }
  }
  return out;
}

/** Below this, a step's height change is within DEM noise and isn't shown. */
const MIN_VERTICAL_M = 10;

/**
 * Approximate net height change of a step in metres (negative = descent),
 * rounded to 10 m, or null when either end has no elevation or the change is
 * within DEM noise. Node elevations are DEM-derived (junctions averaged or
 * interpolated), so this is end-to-end, not the piste's full profile.
 */
export function verticalChange(step, nodes) {
  const a = nodes.get(step.from)?.elevation;
  const b = nodes.get(step.to)?.elevation;
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  const d = Math.round((b - a) / 10) * 10;
  return Math.abs(d) < MIN_VERTICAL_M ? null : d;
}
