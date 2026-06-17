// Maps a correlation value [-1, 1] to an RdBu-style background colour
function corrColor(v) {
  if (v === null || v === undefined || isNaN(v)) return '#f8fafc'
  const t = (v + 1) / 2  // 0 = -1 (red), 0.5 = 0 (white), 1 = +1 (blue)
  if (t < 0.5) {
    const i = t / 0.5
    const r = Math.round(239 + (255 - 239) * (1 - i))
    const g = Math.round(68  + (255 - 68)  * (1 - i))
    const b = Math.round(68  + (255 - 68)  * (1 - i))
    return `rgb(${r},${g},${b})`
  } else {
    const i = (t - 0.5) / 0.5
    const r = Math.round(255 - (255 - 59)  * i)
    const g = Math.round(255 - (255 - 130) * i)
    const b = Math.round(255 - (255 - 246) * i)
    return `rgb(${r},${g},${b})`
  }
}

function corrHeatmap(matrix) {
  if (!matrix?.columns?.length || !matrix?.matrix?.length) return ''
  const cols = matrix.columns
  const cellW = Math.min(72, Math.floor(640 / (cols.length + 1)))

  const headerCells = cols.map(c =>
    `<th style="padding:4px;font-size:10px;font-weight:600;color:#64748b;text-align:center;max-width:${cellW}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c)}</th>`
  ).join('')

  const bodyRows = matrix.matrix.map((row, i) => {
    const cells = row.map((v, j) => {
      const bg   = corrColor(i === j ? 1 : v)
      const text = i === j ? '1.00' : (v === null ? '-' : Number(v).toFixed(2))
      const dark = i === j || Math.abs(v ?? 0) > 0.6
      return `<td style="padding:6px 4px;text-align:center;background:${bg};color:${dark ? '#1e293b' : '#475569'};font-size:11px;font-weight:${Math.abs(v ?? 0) > 0.75 ? '700' : '400'};border:1px solid #f1f5f9">${text}</td>`
    }).join('')
    const rowLabel = `<td style="padding:6px 8px;font-size:10px;font-weight:600;color:#64748b;white-space:nowrap;border:1px solid #f1f5f9">${esc(cols[i])}</td>`
    return `<tr>${rowLabel}${cells}</tr>`
  }).join('')

  return `
<h2>Correlation Matrix</h2>
<div style="overflow-x:auto">
  <table style="border-collapse:collapse;font-size:12px">
    <thead><tr><th></th>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <p style="font-size:11px;color:#94a3b8;margin-top:8px">
    <span style="display:inline-block;width:10px;height:10px;background:rgb(239,68,68);border-radius:2px;margin-right:4px"></span>Negative &nbsp;
    <span style="display:inline-block;width:10px;height:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:2px;margin-right:4px"></span>None &nbsp;
    <span style="display:inline-block;width:10px;height:10px;background:rgb(59,130,246);border-radius:2px;margin-right:4px"></span>Positive
  </p>
</div>`
}

export function downloadReport(profile, tableName = 'dataset') {
  const { summary, insights, abnormal_columns, strong_correlations, correlation_matrix } = profile
  const now = new Date().toLocaleString()

  const insightRows = (arr, color) =>
    (arr ?? []).map(t =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:${color}">${esc(t)}</td></tr>`
    ).join('')

  const colRows = (abnormal_columns ?? []).map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-weight:500">${esc(c.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${esc(c.issue)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${c.null_rate_pct}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${c.outlier_count}</td>
    </tr>`).join('')

  const corrRows = (strong_correlations ?? []).map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${esc(c.col_a)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${esc(c.col_b)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;color:${Math.abs(c.correlation) > 0.9 ? '#dc2626' : '#d97706'}">${c.correlation}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#94a3b8;font-size:11px">${c.method}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DataGrid Health Report - ${esc(tableName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #1e293b; background: #fff; padding: 40px; max-width: 960px; margin: 0 auto; }
  h1  { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  h2  { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin: 32px 0 12px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
  .meta { font-size: 12px; color: #94a3b8; margin-bottom: 32px; }
  .chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .chip { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
  .chip-val { font-size: 24px; font-weight: 700; color: #1e293b; }
  .chip-lbl { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .chip.warn { border-color: #fcd34d; background: #fffbeb; }
  .chip.warn .chip-val { color: #d97706; }
  table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.data thead th { padding: 8px 12px; text-align: left; background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; background: #dbeafe; color: #1d4ed8; }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #cbd5e1; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>

<h1>Data Health Report</h1>
<p class="meta">Dataset: <strong>${esc(tableName)}</strong> &nbsp;·&nbsp; ${esc(now)} &nbsp;·&nbsp; <span class="badge">DataGrid AI</span></p>

<h2>Dataset Summary</h2>
<div class="chips">
  <div class="chip"><div class="chip-val">${summary.rows.toLocaleString()}</div><div class="chip-lbl">Rows</div></div>
  <div class="chip"><div class="chip-val">${summary.columns}</div><div class="chip-lbl">Columns</div></div>
  <div class="chip ${summary.null_rate_pct > 5 ? 'warn' : ''}"><div class="chip-val">${summary.null_rate_pct}%</div><div class="chip-lbl">Null Rate</div></div>
  <div class="chip ${summary.outliers_flagged > 0 ? 'warn' : ''}"><div class="chip-val">${summary.outliers_flagged}</div><div class="chip-lbl">Outliers Flagged</div></div>
</div>

<h2>Quality Insights: Excellences</h2>
<table class="data">
  <tbody>${insightRows(insights?.excellences, '#059669')}</tbody>
</table>

<h2>Quality Insights: Issues</h2>
<table class="data">
  <tbody>${insightRows(insights?.major_issues, '#dc2626')}</tbody>
</table>

${(insights?.fixes?.length) ? `
<h2>Recommended Fixes</h2>
<table class="data">
  <tbody>${insightRows(insights.fixes, '#0369a1')}</tbody>
</table>` : ''}

${abnormal_columns?.length ? `
<h2>Flagged Columns (${abnormal_columns.length})</h2>
<table class="data">
  <thead><tr><th>Column</th><th>Issue</th><th style="text-align:right">Null %</th><th style="text-align:right">Outliers</th></tr></thead>
  <tbody>${colRows}</tbody>
</table>` : ''}

${strong_correlations?.length ? `
<h2>Strong Correlations (|r| &gt; 0.75)</h2>
<table class="data">
  <thead><tr><th>Column A</th><th>Column B</th><th style="text-align:right">Coefficient</th><th>Method</th></tr></thead>
  <tbody>${corrRows}</tbody>
</table>` : ''}

${corrHeatmap(correlation_matrix)}

<footer>Generated by DataGrid &nbsp;·&nbsp; AI-powered conversational analytics &nbsp;·&nbsp; ${esc(now)}</footer>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `health_report_${tableName.replace(/\s+/g, '_')}.html`
  a.click()
  URL.revokeObjectURL(url)
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
