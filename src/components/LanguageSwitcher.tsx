// A plain dropdown that switches the whole app's language.
// i18n.changeLanguage() is all it takes — every component using
// useTranslation() re-renders with the new language automatically,
// and i18next-browser-languagedetector remembers the choice for
// next time via localStorage.

import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'gu', label: 'ગુજરાતી' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="rounded-md border border-hairline bg-panel px-2 py-1.5 text-sm text-paper"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
