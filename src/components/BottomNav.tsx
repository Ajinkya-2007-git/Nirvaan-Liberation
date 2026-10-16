// Phone-only bottom navigation (Home / Live Map / Request Help). Hidden from the sm
// breakpoint up (desktop uses the header) and on admin pages, which have their own layout.
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Map as MapIcon, HandHelping } from 'lucide-react';

export function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return null;

  const items = [
    { to: '/', label: t('nav.home'), Icon: Home, end: true },
    { to: '/map', label: t('nav.liveMap'), Icon: MapIcon, end: false },
    { to: '/request-help', label: t('nav.requestHelp'), Icon: HandHelping, end: false },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-panel pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3 gap-1 px-2 py-1.5">
        {items.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition ${
                  isActive ? 'bg-aqua text-signal' : 'text-muted'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
