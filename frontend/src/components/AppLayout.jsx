import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function AppLayout() {
  const { user, logout, isDeveloper, canManageMasterData, canTrackBreaks } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">HR</div>
          <div>
            <div className="brand-title">BreakTime</div>
            <div className="brand-sub">Staff Console</div>
          </div>
        </div>

        <nav className="nav">
          <NavLink to="/" end>Employee portal</NavLink>
          <NavLink to="/app" end>Dashboard</NavLink>
          {canTrackBreaks && <NavLink to="/app/tracking">Live Tracking</NavLink>}
          {canManageMasterData && <NavLink to="/app/employees">Employees</NavLink>}
          {canManageMasterData && <NavLink to="/app/departments">Departments</NavLink>}
          <NavLink to="/app/reports">Reports</NavLink>
          {isDeveloper && <NavLink to="/app/users">Users</NavLink>}
          {isDeveloper && <NavLink to="/app/settings">Settings</NavLink>}
          {isDeveloper && <NavLink to="/app/audit">Audit Log</NavLink>}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <strong>{user?.fullName}</strong>
            <span>{user?.roles?.join(', ')}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>Sign out</button>
        </div>
      </aside>

      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}
