// A shared header used across every page. Two jobs:
//   1. Always give a way back to the homepage (this was missing
//      before — easy to get stranded on /map with no way out).
//   2. Show "Sign out" ONLY when someone is actually logged in —
//      a public visitor filling out the SOS form shouldn't see a
//      sign-out button for an account that doesn't exist.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTheme } from '../hooks/useTheme';

export function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  // "undefined" = still checking, "null" = confirmed logged out,
  // an object = confirmed logged in. Starting at "undefined" avoids
  // a flash of the wrong button while we check.
  const [session, setSession] = useState<object | null | undefined>(undefined);

  useEffect(() => {
    // Check once immediately on load...
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    // ...then keep listening for login/logout events for as long as
    // this component is on screen, so the button updates instantly
    // without needing a page refresh.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    // "sticky top-0" keeps this header pinned as the page scrolls —
    // combined with backdrop-blur, it reads as a translucent glass
    // panel over whatever content scrolls underneath it, which is
    // what makes it feel like a modern app shell rather than a
    // plain static banner.
    <header className="sticky top-0 z-40 border-b border-hairline bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          {/* The actual logo mark — cropped from your shield emblem
              with a transparent background, so it sits directly on
              the dark header without any stray box around it. */}
          <img src="/logo-mark.png" alt="" className="h-8 w-8" />
          <span className="font-display text-lg font-bold tracking-tight text-paper">NIRVAAN</span>
        </Link>

        <div className="flex items-center gap-5">
          <LanguageSwitcher />
          {/* Toggles the data-theme attribute this whole re-theme
              relies on (see useTheme.ts + index.css). Icon flips to
              show what you'd SWITCH TO, not the current state — a
              moon icon means "tap to go dark," which is the more
              common convention for this kind of toggle. */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="rounded-md border border-hairline p-1.5 text-muted transition hover:border-signal hover:text-paper"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <Link to="/map" className="text-sm text-muted transition hover:text-paper">
            {t('header.liveMap')}
          </Link>
          <Link
            to="/request-help"
            className="rounded-md bg-signal-orange px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t('header.requestHelp')}
          </Link>
          {session && (
            <button
              onClick={handleSignOut}
              className="rounded-md border border-hairline px-3 py-1.5 text-sm text-muted transition hover:border-signal hover:text-paper"
            >
              {t('header.signOut')}
            </button>
          )}
        </div>
      </div>

      {/* The urgency-color spectrum, used here as a recurring visual
          signature rather than a decorative stripe — these are the
          EXACT SAME colors the map pins use (see mapIcons.ts), so
          this strip is a quiet, literal preview of how the whole
          system reads severity, not just decoration. */}
      <div className="flex h-1 w-full">
        <div className="flex-1 bg-black" />
        <div className="flex-1 bg-signal-red" />
        <div className="flex-1 bg-signal-orange" />
        <div className="flex-1" style={{ backgroundColor: '#eab308' }} />
        <div className="flex-1" style={{ backgroundColor: '#fef08a' }} />
        <div className="flex-1 bg-signal" />
      </div>
    </header>
  );
}
