import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { LoadingBlock, MessageBar } from '../components/UiBits';

const KPI_ICONS = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35" />
      <path d="M16.5 3.7a3.5 3.5 0 0 1 0 6.6" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  equal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M5 9h14M5 15h14" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M8 6h11M8 12h11M8 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
};

function KpiCard({ label, value, icon, tone }) {
  return (
    <article className={`portal-kpi portal-kpi--${tone} portal-widget-3d`}>
      <div className="portal-kpi__top">
        <span className="portal-kpi__label">{label}</span>
        <span className="portal-kpi__icon">{icon}</span>
      </div>
      <div className="portal-kpi__value">{value}</div>
    </article>
  );
}

function QuickLink({ title, description, to, cta, tone }) {
  return (
    <Link to={to} className={`portal-quick portal-quick--${tone} portal-widget-3d`}>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="portal-quick__cta">{cta}</span>
    </Link>
  );
}

function welcomeCopy(auth) {
  if (auth.isDeveloper) {
    return {
      eyebrow: 'Dashboard',
      title: 'Developer overview',
      subtitle: 'Monitor break compliance, manage master data, and review system settings.',
    };
  }
  if (auth.isHRManager) {
    return {
      eyebrow: 'Dashboard',
      title: 'HR Manager overview',
      subtitle: 'Track live breaks, manage employees and departments, and generate compliance reports.',
    };
  }
  return {
    eyebrow: 'Dashboard',
    title: 'HR Assistant overview',
    subtitle: 'Follow live break activity and produce daily compliance reports for the team.',
  };
}

export default function DashboardPage() {
  const auth = useAuth();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const copy = useMemo(
    () => welcomeCopy(auth),
    [auth.isDeveloper, auth.isHRManager, auth.isHRAssistant],
  );

  useEffect(() => {
    let timer;
    const load = async () => {
      try {
        const res = await api.get('/reports/dashboard');
        setData(res.data);
        setMessage('');
      } catch (err) {
        setMessage(err.response?.data?.message || 'Failed to load dashboard.');
      }
    };
    load();
    timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!data && !message) return <LoadingBlock label="Loading dashboard…" />;

  const firstName = auth.user?.fullName?.split(' ')[0] || 'there';

  return (
    <div className="page portal-dashboard">
      <header className="portal-dash-header">
        <div>
          <p className="portal-eyebrow">{copy.eyebrow}</p>
          <h1 className="portal-display">
            Welcome, {firstName}
            <span className="portal-display__sub">{copy.title}</span>
          </h1>
          <p className="portal-lead">{copy.subtitle}</p>
        </div>
        {auth.canTrackBreaks && (
          <Link className="btn btn-primary" to="/app/tracking">
            Open live tracking
          </Link>
        )}
      </header>

      <MessageBar message={message} type="error" onClose={() => setMessage('')} />

      {data && (
        <>
          <section className="portal-kpi-grid" aria-label="Today’s break KPIs">
            <KpiCard label="Active employees" value={data.activeEmployees} icon={KPI_ICONS.users} tone="slate" />
            <KpiCard label="Departments" value={data.activeDepartments} icon={KPI_ICONS.building} tone="violet" />
            <KpiCard label="On break now" value={data.onBreakNow} icon={KPI_ICONS.clock} tone="amber" />
            <KpiCard label="Well satisfied" value={data.wellSatisfiedToday} icon={KPI_ICONS.check} tone="emerald" />
            <KpiCard label="Satisfied" value={data.satisfiedToday} icon={KPI_ICONS.equal} tone="sky" />
            <KpiCard label="Exceeded limit" value={data.exceededToday} icon={KPI_ICONS.alert} tone="rose" />
            <KpiCard label="Break sessions today" value={data.totalBreaksToday} icon={KPI_ICONS.list} tone="teal" />
          </section>

          <section className="portal-quick-section">
            <div className="portal-section-head">
              <h2>Quick actions</h2>
              <p>Jump into the workflows you use most for today’s break tracking.</p>
            </div>
            <div className="portal-quick-grid">
              {auth.canTrackBreaks && (
                <QuickLink
                  title="Live Tracking"
                  description="Watch who is out on break and toggle sessions in real time."
                  to="/app/tracking"
                  cta="Open tracking"
                  tone="amber"
                />
              )}
              {auth.canManageMasterData && (
                <QuickLink
                  title="Employees"
                  description="Maintain employee codes, departments, and active status."
                  to="/app/employees"
                  cta="Manage employees"
                  tone="sky"
                />
              )}
              {auth.canManageMasterData && (
                <QuickLink
                  title="Departments"
                  description="Organize teams and keep department master data current."
                  to="/app/departments"
                  cta="Manage departments"
                  tone="violet"
                />
              )}
              <QuickLink
                title="Reports"
                description="Generate A4 print-ready compliance reports and export CSV."
                to="/app/reports"
                cta="Open reports"
                tone="emerald"
              />
              {auth.isDeveloper && (
                <QuickLink
                  title="Users & settings"
                  description="Control staff accounts, daily limits, and audit history."
                  to="/app/users"
                  cta="Open admin"
                  tone="slate"
                />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
