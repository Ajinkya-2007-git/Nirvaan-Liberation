// Deep-navy footer with quick language links.
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../lib/languages';

export function Footer() {
  const { t, i18n } = useTranslation();
  const active = (i18n.language || 'en').split('-')[0];
  return (
    <footer className="mt-12 bg-navy text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-white/90">{t('home.footer')}</p>
        <div className="flex items-center gap-3 text-sm text-white/75">
          {LANGUAGES.map((l, i) => (
            <span key={l.code} className="flex items-center gap-3">
              <button
                onClick={() => i18n.changeLanguage(l.code)}
                className={l.code === active ? 'font-semibold text-white' : 'hover:text-white'}
              >
                {l.label}
              </button>
              {i < LANGUAGES.length - 1 && <span aria-hidden>/</span>}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
