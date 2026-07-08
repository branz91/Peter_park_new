/**
 * Piccole utility geografiche usate dalla mappa per la ricerca "in questa zona".
 * Nessuna dipendenza esterna: calcoli sufficientemente accurati per distanze
 * urbane (qualche km).
 */

const EARTH_RADIUS_M = 6371000;
const METERS_PER_LAT_DEGREE = 111320;

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Distanza in metri tra due coordinate (formula dell'emisenoverso / haversine).
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Raggio in metri che copre (circa) l'area visibile della mappa, partendo dal
 * suo centro. Usa il lato piu' lungo tra larghezza e altezza visibili.
 * Il risultato e' limitato tra `minMeters` e `maxMeters` per evitare query
 * troppo piccole o troppo grandi.
 */
export function radiusFromRegion(
  region: MapRegion,
  minMeters = 300,
  maxMeters = 20000
): number {
  const latMeters = region.latitudeDelta * METERS_PER_LAT_DEGREE;
  const lngMeters =
    region.longitudeDelta * METERS_PER_LAT_DEGREE * Math.cos(toRadians(region.latitude));
  const half = Math.max(latMeters, lngMeters) / 2;
  return Math.round(Math.min(maxMeters, Math.max(minMeters, half)));
}
