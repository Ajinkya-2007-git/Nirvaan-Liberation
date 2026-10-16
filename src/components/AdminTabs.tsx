// Tab row shown ONLY to admins, at the top of Live Map and of every admin page, so you can
// always move between the map, the request list, the impact numbers and NGO allotment.
import { NavLink } from 'react-router-dom';
import { useRole } from '../hooks/useRole';

const TABS = [
  { to: '/map', label: 'Live Map', end: true },
  { to: '/admin/requests', label: 'Requests', end: false },
  { to: '/admin/impact', label: 'Impact', end: false },
  { to: '/admin/ngos', label: 'NGO allotment', end: false },
];

export function AdminTabs() {
  const { role } = useRole();
  if (role !== 'admin') return null; // everyone else sees nothing

  return (
    <div className="border-b border-hairline bg-panel">
      {/* Scrolls sideways on narrow phones instead of wrapping. */}
      <div className="mx-auto flex max-w-[1400px] gap-2 overflow-x-auto px-4 py-2 sm:px-6">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isActive ? 'bg-signal text-white' : 'text-muted hover:bg-aqua hover:text-paper'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
