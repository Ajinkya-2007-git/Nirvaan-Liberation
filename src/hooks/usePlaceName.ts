// Looks up the place name for a pair of coordinates (or nothing, if none given yet).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reverseGeocode } from '../lib/place';

export function usePlaceName(lat: number | null | undefined, lng: number | null | undefined) {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  // One key per (place, language): a result is only used while it still matches the current key,
  // so a stale answer from a previous location can never show up for a new one.
  const key = lat == null || lng == null ? null : `${lat},${lng},${lang}`;
  const [result, setResult] = useState<{ key: string | null; label: string | null }>({ key: null, label: null });

  useEffect(() => {
    if (key === null || lat == null || lng == null) return;
    let active = true;
    reverseGeocode(lat, lng, lang).then((label) => {
      if (active) setResult({ key, label });
    });
    return () => {
      active = false;
    };
  }, [key, lat, lng, lang]);

  return result.key === key ? result.label : null;
}
