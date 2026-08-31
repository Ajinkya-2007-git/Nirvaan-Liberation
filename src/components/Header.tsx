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
      {/* flex-wrap is a deliberate safety net: on a narrow phone
          screen, if everything genuinely doesn't fit on one line,
          items now wrap to a second line instead of the rightmost
          one (Request Help) getting silently clipped past the edge
          of the screen — which is what was actually happening
          before. Reduced padding/gaps on small screens (the "sm:"
          variants below) mean wrapping should rarely even be needed
          in practice, but it's there as a guarantee either way. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="flex items-center gap-2">
          {/* The actual logo mark — cropped from your shield emblem
              with a transparent background, so it sits directly on
              the dark header without any stray box around it. */}
          <img src="/logo-mark.png" alt="" className="h-7 w-7 sm:h-8 sm:w-8" />
          <span className="font-display text-base font-bold tracking-tight text-paper sm:text-lg">NIRVAAN</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-5">
          <LanguageSwitcher />
          {/* Toggles the data-theme attribute this whole re-theme
              relies on (see useTheme.ts + index.css). Icon flips to
              show what you'd SWITCH TO, not the current state — a
              moon icon means "tap to go dark," which is the more
              common convention for this kind of toggle. */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="shrink-0 rounded-md border border-hairline p-1.5 text-muted transition hover:border-signal hover:text-paper"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          {/* Hidden below the "sm" breakpoint — this is the item
              that's safe to drop on a narrow phone screen, since
              /map is also reachable from the landing page itself.
              Request Help and Sign out stay visible everywhere,
              since those are the actions someone's actually likely
              to need mid-emergency or mid-session. */}
          <Link to="/map" className="hidden text-sm text-muted transition hover:text-paper sm:inline">
            {t('header.liveMap')}
          </Link>
          <Link
            to="/request-help"
            className="shrink-0 rounded-md bg-signal-orange px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm"
          >
            {t('header.requestHelp')}
          </Link>
          {session && (
            <button
              onClick={handleSignOut}
              className="shrink-0 rounded-md border border-hairline px-2.5 py-1.5 text-xs text-muted transition hover:border-signal hover:text-paper sm:px-3 sm:text-sm"
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
