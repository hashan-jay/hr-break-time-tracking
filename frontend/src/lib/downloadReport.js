/**
 * Download a self-contained HTML report (same approach as RoarFitnessERP downloadHtmlBill).
 */
export function downloadHtmlReport(filename, bodyHtml) {
  const safeName = filename.endsWith('.html') ? filename : `${filename}.html`;
  const blob = new Blob(
    [
      '<!DOCTYPE html><html><head><meta charset="utf-8" />',
      `<title>${safeName}</title>`,
      '<style>',
      '@page { size: A4 portrait; margin: 12mm; }',
      'body{font-family:Arial,Helvetica,sans-serif;padding:0;margin:0;color:#111;background:#fff;}',
      '.sheet{max-width:210mm;margin:0 auto;padding:8mm;}',
      'h1{margin:0 0 4px;font-size:20px;}',
      'h2{margin:0;font-size:13px;font-weight:600;color:#444;}',
      '.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:16px 0;font-size:13px;}',
      '.meta div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #eee;padding:4px 0;}',
      '.meta span{color:#666;font-size:12px;}',
      '.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 18px;}',
      '.kpi{border:1px solid #ddd;border-radius:6px;padding:8px;text-align:center;}',
      '.kpi strong{display:block;font-size:18px;}',
      '.kpi span{font-size:11px;color:#555;}',
      'table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;}',
      'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}',
      'th{background:#f3f3f3;}',
      '.footer{margin-top:24px;text-align:center;color:#666;font-size:12px;border-top:1px solid #ddd;padding-top:10px;}',
      '.status-green{color:#1f7a45;font-weight:700;}',
      '.status-blue{color:#1d4f91;font-weight:700;}',
      '.status-red{color:#b42318;font-weight:700;}',
      '</style></head><body><div class="sheet">',
      bodyHtml,
      '</div></body></html>',
    ].join(''),
    { type: 'text/html;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatGeneratedAt(date = new Date()) {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
