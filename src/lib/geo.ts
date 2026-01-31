export type LatLng = { lat: number; lng: number };

export function milesBetween(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.7613; // Earth radius in miles

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * (sinDLng * sinDLng);

  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return R * c;
}

export function getBrowserLocation(timeoutMs = 8000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported.'));
      return;
    }

    const onSuccess: PositionCallback = (pos) => {
      resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };

    const onError: PositionErrorCallback = (err) => {
      reject(new Error(err.message || 'Failed to get location.'));
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 60_000,
    });
  });
}
