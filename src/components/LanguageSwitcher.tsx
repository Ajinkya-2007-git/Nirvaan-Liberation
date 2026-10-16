// Language menu: a button (translate icon + language) that opens a small list.
// Custom instead of a native <select> so phones can show just "EN" while desktops show "English".
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, ChevronDown } from 'lucide-react';
import { LANGUAGES } from '../lib/languages';


export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === (i18n.language || 'en').split('-')[0]) ?? LANGUAGES[0];

  // Close the menu when tapping anywhere outside it.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('nav.language')}
        aria-expanded={open}
        className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-paper transition hover:bg-aqua"
      >
        <Languages size={18} className="text-signal" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{current.short}</span>
        <ChevronDown size={14} className="hidden text-muted sm:inline" />
      </button>

      {open && (
        <ul className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-hairline bg-panel py-1 shadow-lg">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                onClick={() => {
                  i18n.changeLanguage(l.code);
                  setOpen(false);
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-aqua ${
                  l.code === current.code ? 'font-semibold text-signal' : 'text-paper'
                }`}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
