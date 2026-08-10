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
