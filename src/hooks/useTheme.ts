// Manages switching between light (default) and dark mode. The
// actual re-theming happens purely in CSS (see index.css's
// [data-theme='dark'] block) — this hook's only job is setting that
// data-theme attribute on <html> and remembering the choice.

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first (a returning visitor's saved choice).
    // Falling back to 'light' — NOT the device's OS-level dark mode
    // setting — is deliberate: the requirement was "default stays
    // the current [light] mode" for everyone, not "match whatever
    // the phone is already set to."
    const saved = localStorage.getItem('nirvaan-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('nirvaan-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }

  return { theme, toggleTheme };
}
