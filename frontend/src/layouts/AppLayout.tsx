import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/players', label: 'Players' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/drills', label: 'Drills' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white px-4 py-6 flex flex-col">
        <h1 className="text-xl font-semibold mb-8">Crick</h1>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-200">
          <p className="text-sm font-medium text-slate-900 truncate" title={user?.name ?? ''}>
            {user?.name ?? '—'}
          </p>
          <p className="text-xs text-slate-500 truncate mb-3" title={user?.email ?? ''}>
            {user?.email ?? ''}
          </p>
          <button
            type="button"
            onClick={logout}
            className="w-full text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md py-1.5 border border-slate-200"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
