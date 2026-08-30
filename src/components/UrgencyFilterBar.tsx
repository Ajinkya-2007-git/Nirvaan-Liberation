// A row of toggle chips letting anyone viewing a map — a volunteer,
// an NGO, an admin, or even someone who just submitted their own
// request — show or hide pins by urgency. Colors match mapIcons.ts
// exactly, same reasoning as the header's spectrum strip: these
// colors already carry real meaning elsewhere in the app, so the
// filter reuses that meaning instead of inventing new colors.

export type UrgencyFilterKey = 'critical' | 'high' | 'medium' | 'low' | 'unclassified';

const FILTERS: { key: UrgencyFilterKey; label: string; color: string }[] = [
  { key: 'critical', label: 'Critical', color: '#dc2626' },
  { key: 'high', label: 'High', color: '#ea580c' },
  { key: 'medium', label: 'Medium', color: '#eab308' },
  { key: 'low', label: 'Low', color: '#fef08a' },
  { key: 'unclassified', label: 'Unclassified', color: '#000000' },
];

interface UrgencyFilterBarProps {
  active: Set<UrgencyFilterKey>;
  onToggle: (key: UrgencyFilterKey) => void;
}

export function UrgencyFilterBar({ active, onToggle }: UrgencyFilterBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-hairline bg-panel px-6 py-2">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted">Show:</span>
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
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
              isActive ? 'border-hairline text-paper' : 'border-hairline/50 text-muted opacity-50'
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full border border-white/30"
              style={{ backgroundColor: f.color }}
            />
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
