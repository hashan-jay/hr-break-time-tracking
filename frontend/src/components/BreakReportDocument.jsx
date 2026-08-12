import { formatGeneratedAt } from '../lib/downloadReport';

function statusClass(color) {
  if (color === 'green') return 'status-green';
  if (color === 'blue') return 'status-blue';
  if (color === 'red') return 'status-red';
  return '';
}

/**
 * A4 printable break-time report document (RoarFitnessERP monthly-report pattern).
 */
export default function BreakReportDocument({ report, filters }) {
  if (!report) return null;

  const generatedAt = formatGeneratedAt();
  const deptLabel = filters?.departmentName || 'All departments';
  const empLabel = filters?.employeeName || 'All employees';

  return (
    <div className="break-report-document">
      <header className="break-report-document__header print-header">
        <h1>HR Break Time Tracking</h1>
        <h2>Employee Daily Break Compliance Report</h2>
        <p>Generated {generatedAt} (PC local time)</p>
      </header>

      <section className="break-report-document__meta print-section">
        <div>
          <span>Period from</span>
          <strong>{report.from}</strong>
        </div>
        <div>
          <span>Period to</span>
          <strong>{report.to}</strong>
        </div>
        <div>
          <span>Department</span>
          <strong>{deptLabel}</strong>
        </div>
        <div>
          <span>Employee</span>
          <strong>{empLabel}</strong>
        </div>
        <div>
          <span>Daily limit</span>
          <strong>{report.dailyLimitMinutes} minutes</strong>
        </div>
        <div>
          <span>Employee-days</span>
          <strong>{report.employeeDays}</strong>
        </div>
      </section>

      <section className="break-report-document__kpis print-section">
        <div className="kpi">
          <strong>{report.wellSatisfiedCount}</strong>
          <span>Well Satisfied (&lt; limit)</span>
        </div>
        <div className="kpi">
          <strong>{report.satisfiedCount}</strong>
          <span>Satisfied (= limit)</span>
        </div>
        <div className="kpi">
          <strong>{report.exceededCount}</strong>
          <span>Exceeded (&gt; limit)</span>
        </div>
        <div className="kpi">
          <strong>{report.rows?.length || 0}</strong>
          <span>Rows in report</span>
        </div>
      </section>

      <section className="print-section">
        <h3 className="break-report-document__section-title">Detailed break totals</h3>
        <table className="break-report-document__table print-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Code</th>
              <th>Employee</th>
              <th>Department</th>
              <th>Total (HH:MM:SS)</th>
              <th>Seconds</th>
              <th>Breaks</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(report.rows || []).map((r) => (
              <tr key={`${r.employeeId}-${r.date}`}>
                <td>{r.date}</td>
                <td>{r.employeeCode}</td>
                <td>{r.employeeName}</td>
                <td>{r.departmentName}</td>
                <td>{r.totalBreakDisplay}</td>
                <td>{r.totalBreakSeconds}</td>
                <td>{r.breakCount}</td>
                <td className={statusClass(r.statusColor)}>{r.status}</td>
              </tr>
            ))}
            {!report.rows?.length && (
              <tr>
                <td colSpan={8}>No records for the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer className="break-report-document__footer">
        Status rules: Well Satisfied (&lt; {report.dailyLimitMinutes} min) · Satisfied (= {report.dailyLimitMinutes} min) · Exceeded (&gt; {report.dailyLimitMinutes} min).
        Totals are calculated second-accurately from out-time / in-time records.
      </footer>
    </div>
  );
}

export function renderBreakReportHtml(report, filters) {
  const generatedAt = formatGeneratedAt();
  const deptLabel = filters?.departmentName || 'All departments';
  const empLabel = filters?.employeeName || 'All employees';
  const rows = (report.rows || [])
    .map((r) => {
      const cls =
        r.statusColor === 'green'
          ? 'status-green'
          : r.statusColor === 'blue'
            ? 'status-blue'
            : r.statusColor === 'red'
              ? 'status-red'
              : '';
      return `<tr>
        <td>${r.date}</td>
        <td>${r.employeeCode}</td>
        <td>${escapeHtml(r.employeeName)}</td>
        <td>${escapeHtml(r.departmentName)}</td>
        <td>${r.totalBreakDisplay}</td>
        <td>${r.totalBreakSeconds}</td>
        <td>${r.breakCount}</td>
        <td class="${cls}">${escapeHtml(r.status)}</td>
      </tr>`;
    })
    .join('');

  return `
    <h1>HR Break Time Tracking</h1>
    <h2>Employee Daily Break Compliance Report</h2>
    <p>Generated ${escapeHtml(generatedAt)} (PC local time)</p>
    <div class="meta">
      <div><span>Period from</span><strong>${report.from}</strong></div>
      <div><span>Period to</span><strong>${report.to}</strong></div>
      <div><span>Department</span><strong>${escapeHtml(deptLabel)}</strong></div>
      <div><span>Employee</span><strong>${escapeHtml(empLabel)}</strong></div>
      <div><span>Daily limit</span><strong>${report.dailyLimitMinutes} minutes</strong></div>
      <div><span>Employee-days</span><strong>${report.employeeDays}</strong></div>
    </div>
    <div class="kpis">
      <div class="kpi"><strong>${report.wellSatisfiedCount}</strong><span>Well Satisfied</span></div>
      <div class="kpi"><strong>${report.satisfiedCount}</strong><span>Satisfied</span></div>
      <div class="kpi"><strong>${report.exceededCount}</strong><span>Exceeded</span></div>
      <div class="kpi"><strong>${report.rows?.length || 0}</strong><span>Rows</span></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Code</th><th>Employee</th><th>Department</th>
          <th>Total</th><th>Seconds</th><th>Breaks</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="8">No records for the selected filters.</td></tr>'}
      </tbody>
    </table>
    <div class="footer">
      Status rules use the configured daily limit (${report.dailyLimitMinutes} minutes).
      Totals are calculated second-accurately from out-time / in-time records.
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
