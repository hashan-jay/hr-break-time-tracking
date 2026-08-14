import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import AppLayout from './components/AppLayout';
import PortalPage from './pages/PortalPage';
import DashboardPage from './pages/DashboardPage';
import TrackingPage from './pages/TrackingPage';
import EmployeesPage from './pages/EmployeesPage';
import DepartmentsPage from './pages/DepartmentsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import AuditPage from './pages/AuditPage';
import { LoadingBlock } from './components/UiBits';
import './App.css';

function ProtectedRoute({ allow }) {
  const { isAuthenticated, loading, roles } = useAuth();
  if (loading) return <LoadingBlock label="Checking session…" />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (allow && !allow.some((role) => roles.includes(role))) {
    return <Navigate to="/app" replace />;
  }
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PortalPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route element={<ProtectedRoute allow={['Developer', 'HRManager', 'HRAssistant']} />}>
            <Route path="tracking" element={<TrackingPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="employees" element={<EmployeesPage />} />
          </Route>
          <Route element={<ProtectedRoute allow={['Developer', 'HRManager']} />}>
            <Route path="departments" element={<DepartmentsPage />} />
          </Route>
          <Route element={<ProtectedRoute allow={['Developer']} />}>
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="audit" element={<AuditPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
