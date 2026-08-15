import { formatGeneratedAt } from '../lib/downloadReport';

function statusClass(color) {
  if (color === 'green') return 'status-green';
  if (color === 'blue') return 'status-blue';
  if (color === 'red') return 'status-red';
  return '';
}

/**
 * A4 printable break-time report document (Meal + Comfort).
 */
export default function BreakReportDocument({ report, filters }) {
  if (!report) return null;

  const generatedAt = formatGeneratedAt();
  const deptLabel = filters?.departmentName || 'All departments';
  const empLabel = filters?.employeeName || 'All employees';
  const shiftLabel = filters?.shiftName || report.shiftDisplay || report.shiftName || 'All shifts';

  return (
    <div className="break-report-document">
      <header className="break-report-document__header print-header">
        <h1>HR Break Time Tracking</h1>
        <h2>Employee Shift-wise Meal & Comfort Break Report</h2>
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
          <span>Shift</span>
          <strong>{shiftLabel}</strong>
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
          <span>Meal limit</span>
          <strong>{report.mealLimitMinutes} minutes</strong>
        </div>
        <div>
          <span>Comfort limit</span>
          <strong>{report.comfortLimitMinutes} minutes</strong>
        </div>
        <div>
          <span>Employee-shifts</span>
          <strong>{report.employeeDays}</strong>
        </div>
      </section>

      <section className="break-report-document__kpis print-section">
        <div className="kpi">
          <strong>{report.mealWellSatisfiedCount}</strong>
          <span>Meal WELL SATISFIED</span>
        </div>
        <div className="kpi">
          <strong>{report.mealExceededCount}</strong>
          <span>Meal EXCEEDED BREAK TIME LIMIT</span>
        </div>
        <div className="kpi">
          <strong>{report.comfortWellSatisfiedCount}</strong>
          <span>Comfort WELL SATISFIED</span>
        </div>
        <div className="kpi">
          <strong>{report.comfortExceededCount}</strong>
          <span>Comfort EXCEEDED BREAK TIME LIMIT</span>
        </div>
      </section>

      <section className="print-section">
        <h3 className="break-report-document__section-title">Detailed break totals</h3>
        <table className="break-report-document__table print-table">
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
            {(report.rows || []).map((r) => (
              <tr key={`${r.employeeId}-${r.date}`}>
                <td>{r.date}{r.periodLabel ? ` · ${r.periodLabel}` : ''}</td>
                <td>{r.employeeCode}</td>
                <td>{r.employeeName}</td>
                <td>{r.departmentName}</td>
                <td>{r.shiftName || '—'}</td>
                <td>{r.mealBreakDisplay}</td>
                <td className={statusClass(r.mealStatusColor)}>{r.mealStatus}</td>
                <td>{r.comfortBreakDisplay}</td>
                <td className={statusClass(r.comfortStatusColor)}>{r.comfortStatus}</td>
              </tr>
            ))}
            {!report.rows?.length && (
              <tr>
                <td colSpan={9}>No records for the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer className="break-report-document__footer">
        Meal limit: {report.mealLimitMinutes} min · Comfort limit: {report.comfortLimitMinutes} min.
        Status rules: WELL SATISFIED (&lt;= X:00) · EXCEEDED BREAK TIME LIMIT (&gt; X:00).
        Totals are calculated second-accurately from out-time / in-time records.
      </footer>
    </div>
  );
}

export function renderBreakReportHtml(report, filters) {
  const generatedAt = formatGeneratedAt();
  const deptLabel = filters?.departmentName || 'All departments';
  const empLabel = filters?.employeeName || 'All employees';
  const shiftLabel = filters?.shiftName || report.shiftDisplay || report.shiftName || 'All shifts';
  const rows = (report.rows || [])
    .map((r) => `<tr>
        <td>${r.date}${r.periodLabel ? ` · ${escapeHtml(r.periodLabel)}` : ''}</td>
        <td>${r.employeeCode}</td>
        <td>${escapeHtml(r.employeeName)}</td>
        <td>${escapeHtml(r.departmentName)}</td>
        <td>${escapeHtml(r.shiftName || '—')}</td>
        <td>${r.mealBreakDisplay}</td>
        <td class="${statusClass(r.mealStatusColor)}">${escapeHtml(r.mealStatus)}</td>
        <td>${r.comfortBreakDisplay}</td>
        <td class="${statusClass(r.comfortStatusColor)}">${escapeHtml(r.comfortStatus)}</td>
      </tr>`)
    .join('');

  return `
    <h1>HR Break Time Tracking</h1>
    <h2>Employee Shift-wise Meal & Comfort Break Report</h2>
    <p>Generated ${escapeHtml(generatedAt)} (PC local time)</p>
    <div class="meta">
      <div><span>Period from</span><strong>${report.from}</strong></div>
      <div><span>Period to</span><strong>${report.to}</strong></div>
      <div><span>Shift</span><strong>${escapeHtml(shiftLabel)}</strong></div>
      <div><span>Department</span><strong>${escapeHtml(deptLabel)}</strong></div>
      <div><span>Employee</span><strong>${escapeHtml(empLabel)}</strong></div>
      <div><span>Meal limit</span><strong>${report.mealLimitMinutes} minutes</strong></div>
      <div><span>Comfort limit</span><strong>${report.comfortLimitMinutes} minutes</strong></div>
      <div><span>Employee-shifts</span><strong>${report.employeeDays}</strong></div>
    </div>
    <div class="kpis">
      <div class="kpi"><strong>${report.mealWellSatisfiedCount}</strong><span>Meal WELL SATISFIED</span></div>
      <div class="kpi"><strong>${report.mealExceededCount}</strong><span>Meal EXCEEDED BREAK TIME LIMIT</span></div>
      <div class="kpi"><strong>${report.comfortWellSatisfiedCount}</strong><span>Comfort WELL SATISFIED</span></div>
      <div class="kpi"><strong>${report.comfortExceededCount}</strong><span>Comfort EXCEEDED BREAK TIME LIMIT</span></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Shift date</th><th>Code</th><th>Employee</th><th>Department</th><th>Shift</th>
          <th>Meal</th><th>Meal status</th><th>Comfort</th><th>Comfort status</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="9">No records for the selected filters.</td></tr>'}
      </tbody>
    </table>
    <div class="footer">
      Meal limit: ${report.mealLimitMinutes} min · Comfort limit: ${report.comfortLimitMinutes} min.
      Status rules: WELL SATISFIED (&lt;= X:00) · EXCEEDED BREAK TIME LIMIT (&gt; X:00).
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
