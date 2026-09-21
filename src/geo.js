// Beyond this radius, a resolved position isn't confidently "on the mountain".
export const VICINITY_KM = 30;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Nearest resort to a coordinate, or null if the list is empty. */
export function nearestResort(lat, lon, resorts) {
  let nearest = null;
  let nearestKm = Infinity;
  for (const r of resorts) {
    const km = haversineKm(lat, lon, r.lat, r.lon);
    if (km < nearestKm) { nearest = r; nearestKm = km; }
  }
  return nearest ? { resort: nearest, km: nearestKm } : null;
}

/**
 * Projects a device position onto an ordered polyline of route waypoints
 * (e.g. a route's node coordinates in travel order) and returns how far
 * along the route that projection falls.
 *
 * Uses a flat-earth (equirectangular) projection around the route's own
 * latitude — accurate enough at the few-kilometre scale of a resort route,
 * far simpler than great-circle projection. Node coordinates are themselves
 * approximate (junction/village centroids, not surveyed piste centerlines —
 * see CLAUDE.md), so this is a nearest-point estimate, not turn-by-turn nav.
 *
 * Returns null if fewer than 2 usable points are given. Otherwise:
 *   { progress: 0-1, segmentIndex, distanceKm, lat, lon } — distanceKm is the
 *   perpendicular distance from the device to the nearest point on the route
 *   (callers use this to decide whether the device is plausibly on it), and
 *   lat/lon is that nearest point itself — the device's position *snapped*
 *   onto the route, suitable for drawing a "you are here" marker that always
 *   sits on the drawn line rather than floating off it.
 */
export function projectOntoRoute(lat, lon, points) {
  if (!points || points.length < 2) return null;

  const R = 6371000; // metres
  const refLat = points[0].lat * Math.PI / 180;
  const toXY = p => ({
    x: R * (p.lon * Math.PI / 180) * Math.cos(refLat),
    y: R * (p.lat * Math.PI / 180),
  });
  const fromXY = p => ({
    lat: p.y / R * 180 / Math.PI,
    lon: p.x / (R * Math.cos(refLat)) * 180 / Math.PI,
  });

  const xy  = points.map(toXY);
  const pos = toXY({ lat, lon });

  // Cumulative distance to the start of each segment, and each segment's own length.
  const segLen = [];
  const cum    = [0];
  for (let i = 0; i < xy.length - 1; i++) {
    const d = Math.hypot(xy[i + 1].x - xy[i].x, xy[i + 1].y - xy[i].y);
    segLen.push(d);
    cum.push(cum[i] + d);
  }
  const totalLen = cum[cum.length - 1];
  if (totalLen === 0) return { progress: 0, segmentIndex: 0, distanceKm: 0, ...points[0] };

  let best = null;
  for (let i = 0; i < xy.length - 1; i++) {
    const a = xy[i], b = xy[i + 1];
    const abx = b.x - a.x, aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    let t = len2 > 0 ? ((pos.x - a.x) * abx + (pos.y - a.y) * aby) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * abx, projY = a.y + t * aby;
    const dist  = Math.hypot(pos.x - projX, pos.y - projY);
    if (!best || dist < best.dist) {
      best = { dist, segmentIndex: i, distAlong: cum[i] + t * segLen[i], projX, projY };
    }
  }

  return {
    progress:     best.distAlong / totalLen,
    segmentIndex: best.segmentIndex,
    distanceKm:   best.dist / 1000,
    ...fromXY({ x: best.projX, y: best.projY }),
  };
}
