/** Offline fallback so common places still pin if Nominatim is slow/blocked. */
export const KNOWN_PLACES: Record<
  string,
  { label: string; lat: number; lng: number }
> = {
  dublin: { label: "Dublin", lat: 53.3498, lng: -6.2603 },
  cork: { label: "Cork", lat: 51.8985, lng: -8.4756 },
  galway: { label: "Galway", lat: 53.2707, lng: -9.0568 },
  limerick: { label: "Limerick", lat: 52.6638, lng: -8.6267 },
  waterford: { label: "Waterford", lat: 52.2593, lng: -7.1101 },
  belfast: { label: "Belfast", lat: 54.5973, lng: -5.9301 },
  derry: { label: "Derry", lat: 54.9966, lng: -7.3086 },
  london: { label: "London", lat: 51.5074, lng: -0.1278 },
  manchester: { label: "Manchester", lat: 53.4808, lng: -2.2426 },
  birmingham: { label: "Birmingham", lat: 52.4862, lng: -1.8904 },
  leeds: { label: "Leeds", lat: 53.8008, lng: -1.5491 },
  glasgow: { label: "Glasgow", lat: 55.8642, lng: -4.2518 },
  edinburgh: { label: "Edinburgh", lat: 55.9533, lng: -3.1883 },
  cardiff: { label: "Cardiff", lat: 51.4816, lng: -3.1791 },
  liverpool: { label: "Liverpool", lat: 53.4084, lng: -2.9916 },
  bristol: { label: "Bristol", lat: 51.4545, lng: -2.5879 },
  sheffield: { label: "Sheffield", lat: 53.3811, lng: -1.4701 },
  newcastle: { label: "Newcastle", lat: 54.9783, lng: -1.6178 },
  nottingham: { label: "Nottingham", lat: 52.9548, lng: -1.1581 },
  leicester: { label: "Leicester", lat: 52.6369, lng: -1.1398 },
  southampton: { label: "Southampton", lat: 50.9097, lng: -1.4044 },
  brighton: { label: "Brighton", lat: 50.8225, lng: -0.1372 },
  oxford: { label: "Oxford", lat: 51.752, lng: -1.2577 },
  cambridge: { label: "Cambridge", lat: 52.2053, lng: 0.1218 },
  harrow: { label: "Harrow", lat: 51.5783, lng: -0.3346 },
  dundee: { label: "Dundee", lat: 56.462, lng: -2.9707 },
  winsford: { label: "Winsford", lat: 53.1904, lng: -2.5237 },
  cheshire: { label: "Cheshire", lat: 53.208, lng: -2.444 },
  "northern ireland": {
    label: "Northern Ireland",
    lat: 54.7877,
    lng: -6.4923,
  },
  ireland: { label: "Ireland", lat: 53.4129, lng: -8.2439 },
};

export function lookupKnownPlace(query: string) {
  const key = query.trim().toLowerCase();
  return KNOWN_PLACES[key] ?? null;
}
