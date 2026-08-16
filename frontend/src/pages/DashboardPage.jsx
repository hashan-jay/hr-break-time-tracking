import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { LoadingBlock, MessageBar, StatusBadge } from '../components/UiBits';
import {
  BREAK_TYPES,
  enrichEmployeesLive,
  formatElapsed,
  typeFields,
} from '../lib/breakHelpers';

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
  const [board, setBoard] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [message, setMessage] = useState('');
  const copy = useMemo(
    () => welcomeCopy(auth),
    [auth.isDeveloper, auth.isHRManager, auth.isHRAssistant],
  );

  useEffect(() => {
    let timer;
    const load = async () => {
      try {
        const dashRes = await api.get('/reports/dashboard');
        setData(dashRes.data);
        if (auth.canTrackBreaks) {
          try {
            const liveRes = await api.get('/breaks/live');
            setBoard(liveRes.data);
          } catch {
            setBoard(null);
          }
        }
        setMessage('');
      } catch (err) {
        setMessage(apiErrorMessage(err, 'Failed to load dashboard.'));
      }
    };
    load();
    timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [auth.canTrackBreaks]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const employeesView = useMemo(
    () => enrichEmployeesLive(board?.employees, nowMs, {
      mealLimitMinutes: board?.mealLimitMinutes ?? data?.mealLimitMinutes,
      comfortLimitMinutes: board?.comfortLimitMinutes ?? data?.comfortLimitMinutes,
    }),
    [board, data, nowMs],
  );

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
          <section className="portal-kpi-grid" aria-label="Workforce overview">
            <KpiCard label="Active employees" value={data.activeEmployees} icon={KPI_ICONS.users} tone="slate" />
            <KpiCard label="Departments" value={data.activeDepartments} icon={KPI_ICONS.building} tone="violet" />
            <KpiCard label="On break now" value={data.onBreakNow} icon={KPI_ICONS.clock} tone="amber" />
          </section>

          <div className="break-type-stack">
            <section className="portal-quick-section">
              <div className="portal-section-head">
                <h2>Meal Break dashboard</h2>
                <p>
                  Meal limit: {data.mealLimitMinutes ?? 60} minutes · Starts allowed:{' '}
                  {data.mealStartLimit ?? 1} per shift. Status counts for each employee&apos;s current shift.
                </p>
              </div>
              <section className="portal-kpi-grid" aria-label="Meal break KPIs">
                <KpiCard label="On meal break" value={data.mealOnBreakNow} icon={KPI_ICONS.clock} tone="amber" />
                <KpiCard label="WELL SATISFIED" value={data.mealWellSatisfiedToday} icon={KPI_ICONS.check} tone="emerald" />
                <KpiCard label="EXCEEDED BREAK TIME LIMIT" value={data.mealExceededToday} icon={KPI_ICONS.alert} tone="rose" />
              </section>
            </section>

            <section className="portal-quick-section">
              <div className="portal-section-head">
                <h2>Comfort Break dashboard</h2>
                <p>
                  Comfort limit: {data.comfortLimitMinutes ?? 20} minutes · Starts allowed:{' '}
                  {data.comfortStartLimit ?? 2} per shift. Status counts for each employee&apos;s current shift.
                </p>
              </div>
              <section className="portal-kpi-grid" aria-label="Comfort break KPIs">
                <KpiCard label="On comfort break" value={data.comfortOnBreakNow} icon={KPI_ICONS.clock} tone="amber" />
                <KpiCard label="WELL SATISFIED" value={data.comfortWellSatisfiedToday} icon={KPI_ICONS.check} tone="emerald" />
                <KpiCard label="EXCEEDED BREAK TIME LIMIT" value={data.comfortExceededToday} icon={KPI_ICONS.alert} tone="rose" />
              </section>
            </section>
          </div>

          {employeesView.length > 0 && (
            <section className="portal-quick-section">
              <div className="portal-section-head">
                <h2>This shift totals</h2>
                <p>
                  Closed (in − out) plus the live timer while a break is open. Totals reset when
                  the current shift ends, before the next shift starts.
                </p>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Employee</th>
                      <th>Meal this shift</th>
                      <th>Meal status</th>
                      <th>Comfort this shift</th>
                      <th>Comfort status</th>
                      <th>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeesView.map((e) => {
                      const meal = typeFields(e, BREAK_TYPES.MEAL);
                      const comfort = typeFields(e, BREAK_TYPES.COMFORT);
                      return (
                        <tr
                          key={e.employeeId}
                          className={[
                            e.isOnBreak ? 'on-break' : '',
                            e.isWithinShift === false && !e.isOnBreak ? 'off-shift' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <td>{e.employeeCode}</td>
                          <td>{e.fullName}</td>
                          <td className={meal.isOnThisBreak ? 'is-live-total' : undefined}>
                            <strong>{meal.totalDisplay}</strong>
                            <div className="muted">{meal.startCount}/{board?.mealStartLimit ?? data?.mealStartLimit ?? 1} starts</div>
                          </td>
                          <td><StatusBadge status={meal.status} color={meal.statusColor} /></td>
                          <td className={comfort.isOnThisBreak ? 'is-live-total' : undefined}>
                            <strong>{comfort.totalDisplay}</strong>
                            <div className="muted">{comfort.startCount}/{board?.comfortStartLimit ?? data?.comfortStartLimit ?? 2} starts</div>
                          </td>
                          <td><StatusBadge status={comfort.status} color={comfort.statusColor} /></td>
                          <td>
                            {e.isOnBreak
                              ? `On ${e.currentBreakType} (${formatElapsed(e.currentBreakElapsedSeconds)})`
                              : e.isWithinShift === false
                                ? 'Off shift'
                                : 'In office'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

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
              {auth.canTrackBreaks && (
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
              {auth.canManageMasterData && (
                <QuickLink
                  title="Shifts"
                  description="Create and edit work shifts for employee assignment and reports."
                  to="/app/shifts"
                  cta="Manage shifts"
                  tone="sky"
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
