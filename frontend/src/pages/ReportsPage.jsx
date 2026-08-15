import { useEffect, useMemo, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { MessageBar, StatusBadge } from '../components/UiBits';
import { useAuth } from '../auth/AuthContext';
import BreakReportDocument, { renderBreakReportHtml } from '../components/BreakReportDocument';
import { downloadHtmlReport } from '../lib/downloadReport';

const todayIso = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function ReportsPage() {
  const { isHRAssistant, canManageMasterData } = useAuth();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [departmentId, setDepartmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');

  useEffect(() => {
    Promise.all([
      api.get('/departments'),
      api.get('/employees'),
      api.get('/shifts'),
    ]).then(([d, e, s]) => {
      setDepartments(d.data);
      setEmployees(e.data);
      setShifts(s.data);
    }).catch((err) => {
      setMsgType('error');
      setMessage(apiErrorMessage(err, 'Failed to load filters.'));
    });
  }, []);

  const filters = useMemo(() => ({
    departmentName: departments.find((d) => String(d.id) === String(departmentId))?.name,
    employeeName: employees.find((e) => String(e.id) === String(employeeId))?.fullName,
    shiftName: shifts.find((s) => String(s.id) === String(shiftId))?.displayLabel
      || report?.shiftDisplay
      || report?.shiftName,
  }), [departments, employees, shifts, departmentId, employeeId, shiftId, report]);

  const load = async () => {
    try {
      const endpoint = isHRAssistant && !canManageMasterData ? '/reports/breaks/view' : '/reports/breaks';
      const { data } = await api.get(endpoint, {
        params: {
          from,
          to: to || from,
          departmentId: departmentId || undefined,
          employeeId: employeeId || undefined,
          shiftId: shiftId || undefined,
        },
      });
      setReport(data);
      setMessage('');
    } catch (err) {
      setMsgType('error');
      setMessage(apiErrorMessage(err, 'Failed to generate report.'));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = () => {
    if (!report?.rows?.length) return;
    const header = [
      'ShiftDate', 'Period', 'Code', 'Employee', 'Department', 'Shift',
      'ComfortTotal', 'ComfortSeconds', 'ComfortStatus', 'ComfortBreaks',
      'MealTotal', 'MealSeconds', 'MealStatus', 'MealBreaks',
    ];
    const lines = report.rows.map((r) => [
      r.date,
      `"${r.periodLabel || ''}"`,
      r.employeeCode,
      `"${r.employeeName}"`,
      `"${r.departmentName}"`,
      `"${r.shiftName || ''}"`,
      r.comfortBreakDisplay,
      r.comfortBreakSeconds,
      `"${r.comfortStatus}"`,
      r.comfortBreakCount,
      r.mealBreakDisplay,
      r.mealBreakSeconds,
      `"${r.mealStatus}"`,
      r.mealBreakCount,
    ].join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `break-report-${from}-to-${to || from}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printA4 = () => {
    if (!report) return;
    document.body.classList.add('printing-break-report');
    window.print();
    window.addEventListener(
      'afterprint',
      () => document.body.classList.remove('printing-break-report'),
      { once: true },
    );
  };

  const saveHtml = () => {
    if (!report) return;
    downloadHtmlReport(
      `break-report-${from}-to-${to || from}.html`,
      renderBreakReportHtml(report, filters),
    );
  };

  return (
    <div className="page">
      <header className="page-header no-print">
        <div>
          <h1>Reports</h1>
          <p>
            Filter by date, shift, department, or employee. Totals are shift-wise: overnight shifts
            (for example 20:00–08:00) stay on one row and do not split at midnight.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={!report?.rows?.length}>
            Export CSV
          </button>
          <button type="button" className="btn btn-ghost" onClick={saveHtml} disabled={!report}>
            Save HTML
          </button>
          <button type="button" className="btn btn-primary" onClick={printA4} disabled={!report}>
            Print A4 Report
          </button>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <div className="toolbar report-filters no-print">
        <label>
          Start date
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          End date
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Shift
          <select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            <option value="">All shifts</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.displayLabel}</option>
            ))}
          </select>
        </label>
        <label>
          Department
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label>
          Employee
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">All</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={load}>Generate</button>
      </div>

      {report && (
        <>
          <p className="hint no-print">
            Limits — Meal: <strong>{report.mealLimitMinutes} min</strong> · Comfort:{' '}
            <strong>{report.comfortLimitMinutes} min</strong>
            {(report.shiftDisplay || report.shiftName) ? (
              <> · Shift: <strong>{report.shiftDisplay || report.shiftName}</strong></>
            ) : null}
          </p>

          <div className="stats-grid compact no-print">
            <div className="stat-card"><div className="stat-value">{report.employeeDays}</div><div className="stat-label">Employee-shifts</div></div>
            <div className="stat-card tone-green"><div className="stat-value">{report.mealWellSatisfiedCount}</div><div className="stat-label">Meal WELL SATISFIED</div></div>
            <div className="stat-card tone-red"><div className="stat-value">{report.mealExceededCount}</div><div className="stat-label">Meal EXCEEDED BREAK TIME LIMIT</div></div>
            <div className="stat-card tone-green"><div className="stat-value">{report.comfortWellSatisfiedCount}</div><div className="stat-label">Comfort WELL SATISFIED</div></div>
            <div className="stat-card tone-red"><div className="stat-value">{report.comfortExceededCount}</div><div className="stat-label">Comfort EXCEEDED BREAK TIME LIMIT</div></div>
          </div>

          <div className="table-wrap no-print">
            <table>
              <thead>
                <tr>
                  <th>Shift date</th>
                  <th>Code</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Shift</th>
                  <th>Meal</th>
                  <th>Meal status</th>
                  <th>Comfort</th>
                  <th>Comfort status</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={`${r.employeeId}-${r.date}`}>
                    <td>
                      {r.date}
                      {r.periodLabel ? <div className="muted">{r.periodLabel}</div> : null}
                    </td>
                    <td>{r.employeeCode}</td>
                    <td>{r.employeeName}</td>
                    <td>{r.departmentName}</td>
                    <td>{r.shiftName || '—'}</td>
                    <td>{r.mealBreakDisplay} <span className="muted">({r.mealBreakCount})</span></td>
                    <td><StatusBadge status={r.mealStatus} color={r.mealStatusColor} /></td>
                    <td>{r.comfortBreakDisplay} <span className="muted">({r.comfortBreakCount})</span></td>
                    <td><StatusBadge status={r.comfortStatus} color={r.comfortStatusColor} /></td>
                  </tr>
                ))}
                {!report.rows.length && (
                  <tr><td colSpan={9} className="empty">No records for the selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="break-report-print-source print-only" aria-hidden="true">
            <BreakReportDocument report={report} filters={filters} />
          </div>
        </>
      )}
    </div>
  );
}
