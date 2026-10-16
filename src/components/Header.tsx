// Top bar used on every page: logo + tagline, main navigation (desktop), language,
// theme switch, sign out (only when logged in) and the Request Help button (desktop;
// on phones the bottom navigation carries it).
import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HandHelping, Sun, Moon, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTheme } from '../hooks/useTheme';

// Highlights the link for the page you're on.
const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition ${isActive ? 'font-semibold text-signal' : 'text-muted hover:text-paper'}`;

export function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  // undefined = still checking, null = logged out, object = logged in.
  const [session, setSession] = useState<object | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo-mark.png" alt="" className="h-9 w-9" />
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold tracking-tight text-paper">NIRVAAN</span>
            <span className="block text-xs text-muted">{t('nav.tagline')}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 sm:flex">
          <NavLink to="/" end className={navClass}>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/map" className={navClass}>
            {t('nav.liveMap')}
          </NavLink>
          <Link to="/#join" className="text-sm text-muted transition hover:text-paper">
            {t('nav.join')}
          </Link>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <button
            onClick={toggleTheme}
            aria-label={theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-signal transition hover:bg-aqua"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {session && (
            <button
              onClick={handleSignOut}
              aria-label={t('nav.signOut')}
              className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-muted transition hover:bg-aqua hover:text-paper"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">{t('nav.signOut')}</span>
            </button>
          )}
          <Link
            to="/request-help"
            className="ml-1 hidden min-h-11 items-center gap-2 rounded-xl bg-signal px-5 text-sm font-semibold text-white transition hover:opacity-90 sm:inline-flex"
          >
            <HandHelping size={18} />
            {t('nav.requestHelp')}
          </Link>
        </div>
      </div>

      {/* The six-colour brand strip: the same colours the map pins use. */}
      <div className="flex h-1 w-full">
        <div className="flex-1 bg-black" />
        <div className="flex-1" style={{ backgroundColor: '#dc2626' }} />
        <div className="flex-1" style={{ backgroundColor: '#ea580c' }} />
        <div className="flex-1" style={{ backgroundColor: '#eab308' }} />
        <div className="flex-1" style={{ backgroundColor: '#fef08a' }} />
        <div className="flex-1 bg-signal" />
      </div>
    </header>
  );
}
