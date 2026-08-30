// Calculates the distance between two GPS points, in kilometers.
// This is the "haversine formula" — the standard math for distance
// between two points on a sphere (the Earth), since you can't just
// subtract latitude/longitude like flat x/y coordinates and get a
// meaningful distance.
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const EARTH_RADIUS_KM = 6371;

  // Convert degrees to radians — the trig functions below all
  // expect radians, not degrees.
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  // This block is the actual haversine formula. It's not something
  // you need to derive yourself — it's a standard, well-known
  // formula, the same one every "distance between two coordinates"
  // tool uses under the hood.
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}
