import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import PortalClock from './PortalClock';

const ICONS = {
  portal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  tracking: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  employees: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35" />
      <path d="M16.5 3.7a3.5 3.5 0 0 1 0 6.6" />
    </svg>
  ),
  departments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15v-4" />
      <path d="M12 15V8" />
      <path d="M16 15v-6" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  shifts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M8 6h11" />
      <path d="M8 12h11" />
      <path d="M8 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
};

function roleLabel(roles = []) {
  if (roles.includes('Developer')) return 'System Developer';
  if (roles.includes('SystemAdministration')) return 'System Administration';
  if (roles.includes('HRManager')) return 'HR Manager';
  if (roles.includes('HRAssistant')) return 'HR Assistant';
  return roles.join(', ') || 'Staff';
}

function SidebarNav({ items, onNavigate }) {
  return (
    <nav className="portal-nav" aria-label="Staff navigation">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            ['portal-nav__link', isActive ? 'is-active' : ''].filter(Boolean).join(' ')
          }
          onClick={onNavigate}
        >
          <span className="portal-nav__icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function StaffSidebar({ user, items, onLogout, onNavigate }) {
  return (
    <aside className="portal-side">
      <div className="portal-brand">
        <div className="portal-brand__mark">BT</div>
        <div>
          <div className="portal-brand__title">Staff Portal</div>
          <div className="portal-brand__sub">BreakTime</div>
        </div>
      </div>

      <SidebarNav items={items} onNavigate={onNavigate} />

      <PortalClock />

      <div className="portal-side__footer">
        <div className="portal-user">
          <strong>{user?.fullName}</strong>
          <span>{roleLabel(user?.roles)}</span>
        </div>
        <button type="button" className="portal-logout" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default function AppLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const onLogout = () => {
    logout();
    navigate('/');
  };

  const items = [
    { to: '/', end: true, label: 'Employee portal', icon: ICONS.portal },
    can('dashboard') && { to: '/app', end: true, label: 'Dashboard', icon: ICONS.dashboard },
    can('tracking') && { to: '/app/tracking', label: 'Live Tracking', icon: ICONS.tracking },
    can('employees') && { to: '/app/employees', label: 'Employees', icon: ICONS.employees },
    can('departments') && { to: '/app/departments', label: 'Departments', icon: ICONS.departments },
    can('shifts') && { to: '/app/shifts', label: 'Shifts', icon: ICONS.shifts },
    can('reports') && { to: '/app/reports', label: 'Reports', icon: ICONS.reports },
    can('users') && { to: '/app/users', label: 'Users', icon: ICONS.users },
    can('settings') && { to: '/app/settings', label: 'Settings', icon: ICONS.settings },
    can('audit') && { to: '/app/audit', label: 'Audit Log', icon: ICONS.audit },
  ].filter(Boolean);

  return (
    <div className="app-portal app-shell">
      <div className="portal-side-desktop">
        <StaffSidebar user={user} items={items} onLogout={onLogout} />
      </div>

      {mobileOpen && (
        <div className="portal-mobile">
          <button
            type="button"
            className="portal-mobile__backdrop"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="portal-mobile__drawer">
            <StaffSidebar
              user={user}
              items={items}
              onLogout={onLogout}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="portal-main-wrap">
        <header className="portal-mobile-bar">
          <button type="button" className="portal-menu-btn" onClick={() => setMobileOpen(true)}>
            Menu
          </button>
          <div className="portal-mobile-bar__title">Staff Portal</div>
        </header>
        <main className="main-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
