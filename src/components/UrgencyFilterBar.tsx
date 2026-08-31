// A row of toggle chips letting anyone viewing a map — a volunteer,
// an NGO, an admin, or even someone who just submitted their own
// request — show or hide pins by urgency. Colors match mapIcons.ts
// exactly, same reasoning as the header's spectrum strip: these
// colors already carry real meaning elsewhere in the app, so the
// filter reuses that meaning instead of inventing new colors.

import { useTranslation } from 'react-i18next';

export type UrgencyFilterKey = 'critical' | 'high' | 'medium' | 'low' | 'unclassified';

// The color and the translation KEY are fixed here — the actual
// display label comes from t() at render time below, so it updates
// live when someone switches language.
const FILTERS: { key: UrgencyFilterKey; color: string }[] = [
  { key: 'critical', color: '#dc2626' },
  { key: 'high', color: '#ea580c' },
  { key: 'medium', color: '#eab308' },
  { key: 'low', color: '#fef08a' },
  { key: 'unclassified', color: '#000000' },
];

interface UrgencyFilterBarProps {
  active: Set<UrgencyFilterKey>;
  onToggle: (key: UrgencyFilterKey) => void;
}

export function UrgencyFilterBar({ active, onToggle }: UrgencyFilterBarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-hairline bg-panel px-4 py-2 sm:gap-2 sm:px-6">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted">{t('urgencyFilter.show')}</span>
      {FILTERS.map((f) => {
        const isActive = active.has(f.key);
        return (
          <button
            key={f.key}
            onClick={() => onToggle(f.key)}
            // A chip that's toggled OFF stays visible but dimmed,
            // rather than disappearing — someone should be able to
            // tell at a glance which categories are currently hidden,
            // not just guess from an empty map.
            className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition sm:gap-1.5 sm:px-3 sm:text-xs ${
              isActive ? 'border-hairline text-paper' : 'border-hairline/50 text-muted opacity-50'
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full border border-white/30"
              style={{ backgroundColor: f.color }}
            />
            {t(`urgencyFilter.${f.key}`)}
          </button>
        );
      })}
    </div>
  );
}
