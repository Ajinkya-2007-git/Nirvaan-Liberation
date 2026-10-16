// Turns coordinates into a readable place name ("Paldi, Ahmedabad · Gujarat") using
// OpenStreetMap's free Nominatim service. Results are cached so the same spot is only
// looked up once, and any failure (offline, blocked) just returns null.
const cache = new Map<string, string | null>();

export async function reverseGeocode(lat: number, lng: number, lang = 'en'): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${lang}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=15&addressdetails=1&accept-language=${lang}&lat=${lat}&lon=${lng}`
    );
    if (!res.ok) throw new Error('lookup failed');
    const json = await res.json();
    const a = json.address ?? {};
    const local: string | undefined = a.suburb || a.neighbourhood || a.quarter || a.village || a.hamlet;
    const city: string | undefined = a.city || a.town || a.county || a.state_district;
    const state: string | undefined = a.state;
    const left = [local, city].filter((p, i, arr) => p && arr.indexOf(p) === i).join(', ');
    const label = [left, state].filter(Boolean).join(' · ') || null;
    cache.set(key, label);
    return label;
  } catch {
    cache.set(key, null);
    return null;
  }
}
