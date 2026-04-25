// Privacy: fuzz exact coordinates to a ~500m random offset within a ~750m radius.
// Public listings only ever store/show the fuzzed point.
export function fuzzCoord(lat: number, lng: number, radiusMeters = 500): { lat: number; lng: number } {
  // 1 deg lat ≈ 111_320 m
  const r = (radiusMeters * Math.sqrt(Math.random())) / 111_320;
  const theta = Math.random() * 2 * Math.PI;
  const dLat = r * Math.cos(theta);
  const dLng = (r * Math.sin(theta)) / Math.cos((lat * Math.PI) / 180);
  return { lat: lat + dLat, lng: lng + dLng };
}

// Approximate exact coords from a typed address — for the demo we use a base point + jitter.
// Real implementation would call a geocoder server-side.
export function geocodeDemo(address: string): { lat: number; lng: number } {
  // Stable hash of the address so the same address keeps the same exact point per session
  let h = 0;
  for (let i = 0; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) | 0;
  const rand = (seed: number) => ((Math.sin(seed) + 1) / 2);
  const baseLat = 37.7749, baseLng = -122.4194;
  return {
    lat: baseLat + (rand(h) - 0.5) * 0.06,
    lng: baseLng + (rand(h + 1) - 0.5) * 0.06,
  };
}
