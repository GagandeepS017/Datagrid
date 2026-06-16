import { useState } from 'react'
import Plot from 'react-plotly.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import Sidebar from './Sidebar'
import { downloadReport } from '../utils/reportExport'

// ── Quality alert helpers ──────────────────────────────────────────────────────
function alertMeta(col) {
  const issue = col.issue.toLowerCase()
  if (issue.includes('outlier'))
    return { title: 'Outliers Detected',   desc: `'${col.name}' has ${col.outlier_count} flagged value${col.outlier_count !== 1 ? 's' : ''}.`, color: 'red' }
  if (issue.includes('skewed'))
    return { title: 'High Skewness',       desc: `'${col.name}' exceeds skewness threshold.`,             color: 'amber' }
  if (issue.includes('heavy'))
    return { title: 'Heavy-Tailed',        desc: `'${col.name}' shows extreme tail behaviour.`,           color: 'amber' }
  if (issue.includes('null') || issue.includes('%'))
    return { title: 'Missing Values',      desc: `'${col.name}' is ${col.null_rate_pct}% null.`,         color: 'blue' }
  return   { title: 'Data Issue',          desc: `'${col.name}': ${col.issue}`,                           color: 'blue' }
}

const ALERT_STYLE = {
  red:   { border: 'border-red-200   bg-red-50',   icon: 'text-red-500',   dot: 'bg-red-500',   label: 'text-red-800'   },
  amber: { border: 'border-amber-200 bg-amber-50', icon: 'text-amber-500', dot: 'bg-amber-400', label: 'text-amber-800' },
  blue:  { border: 'border-blue-200  bg-blue-50',  icon: 'text-blue-500',  dot: 'bg-blue-400',  label: 'text-blue-800'  },
}

// ── Sections ──────────────────────────────────────────────────────────────────

function ClaudeInsights({ insights }) {
  const items = [
    ...(insights?.major_issues ?? []),
    ...(insights?.excellences ?? []),
  ].slice(0, 4)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-blue-500 text-lg">✦</span>
        <h2 className="font-bold text-slate-800">Claude's Quality Insights</h2>
      </div>
      <div className="space-y-3">
        {items.map((text, i) => (
          <div key={i} className="flex gap-4 items-start">
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-md px-2 py-1 shrink-0 mt-0.5 tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
          </div>
        ))}
        {!items.length && (
          <p className="text-sm text-slate-400 italic">No insights available.</p>
        )}
      </div>
    </div>
  )
}

function QualityAlerts({ abnormalColumns, fixes }) {
  const [showFixes, setShowFixes] = useState(false)
  const alerts = abnormalColumns?.map((col) => ({ col, meta: alertMeta(col) })) ?? []

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quality Alerts</span>
        {alerts.length > 0 && (
          <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
            {alerts.length} {alerts.length === 1 ? 'Issue' : 'Issues'}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="text-sm text-green-600 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> No issues detected
        </p>
      ) : (
        <div className="space-y-2">
          {alerts.map(({ meta }, i) => {
            const s = ALERT_STYLE[meta.color]
            return (
              <div key={i} className={`flex gap-3 items-start border rounded-xl p-3 ${s.border}`}>
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                <div>
                  <p className={`text-xs font-semibold ${s.label}`}>{meta.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{meta.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Fixes panel */}
      {showFixes && fixes?.length > 0 && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">🔧 How to fix</p>
          {fixes.map((fix, i) => (
            <div key={i} className="flex gap-2 text-xs text-blue-800">
              <span className="font-bold shrink-0">{i + 1}.</span>
              <span>{fix}</span>
            </div>
          ))}
        </div>
      )}

      {alerts.length > 0 && (
        <button
          onClick={() => setShowFixes((v) => !v)}
          className="mt-auto w-full border border-slate-200 rounded-xl py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {showFixes ? 'Hide Fixes ↑' : 'View Fixes →'}
        </button>
      )}
    </div>
  )
}

function FlaggedColumnCard({ col }) {
  const chartData = col.histogram
    ? col.histogram.counts.map((count, i) => ({
        label: String(col.histogram.bin_edges[i]).slice(0, 9),
        count,
      }))
    : []

  return (
    <div className="bg-white rounded-2xl border border-red-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-800">{col.name}</span>
        </div>
        <span className="text-xs bg-red-50 text-red-500 border border-red-200 rounded-lg px-2 py-0.5 font-medium">
          {col.issue}
        </span>
      </div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis hide />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => [v, 'count']} />
            <Bar dataKey="count" fill="#f87171" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-xs text-slate-400 italic">No histogram data</p>
      )}
    </div>
  )
}

function MissingValuesChart({ matrix, totalRows }) {
  if (!matrix) return null
  const { columns, rows } = matrix
  const hasMissing = rows.some((r) => r.some(Boolean))

  const data = columns.map((col, i) => {
    const nullCount = rows.filter((r) => r[i]).length
    return {
      name: col.length > 9 ? col.slice(0, 8) + '…' : col,
      present: rows.length - nullCount,
      missing: nullCount,
    }
  })

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Missing Values Heatmap</h3>
        <span className="text-xs text-slate-400 font-medium">N = {totalRows.toLocaleString()} ROWS</span>
      </div>
      {!hasMissing ? (
        <p className="text-xs text-green-600 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> No missing values
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v, name) => [v, name === 'present' ? 'Present' : 'Missing']}
              />
              <Bar dataKey="present" stackId="a" fill="#3b82f6"  radius={[0, 0, 0, 0]} />
              <Bar dataKey="missing" stackId="a" fill="#f9a8d4"  radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Present</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-pink-300" /> Missing</span>
          </div>
        </>
      )}
    </div>
  )
}

function ColumnDistribution({ abnormalColumns }) {
  const col = abnormalColumns?.find((c) => c.histogram) ?? null
  if (!col) return null

  const data = col.histogram.counts.map((count, i) => ({
    label: String(col.histogram.bin_edges[i]).slice(0, 8),
    count,
  }))

  const isSkewed = col.issue.toLowerCase().includes('skew')
  const isHeavy  = col.issue.toLowerCase().includes('heavy')
  const tag      = isSkewed ? 'Skewed' : isHeavy ? 'Heavy-tailed' : col.issue.includes('%') ? 'Sparse' : 'Flagged'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{col.name} Distribution</h3>
        <div className="flex gap-2">
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">Numeric</span>
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{tag}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <Bar dataKey="count" fill="#818cf8" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CorrelationMatrix({ matrix }) {
  if (!matrix?.columns?.length || matrix.columns.length < 2) return null
  const cols = matrix.columns
  const z    = matrix.matrix.map((row) => row.map((v) => (v === null ? 0 : v)))
  const text = z.map((row) => row.map((v) => v.toFixed(2)))

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-700">Correlation Matrix</h3>
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Positive</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Negative</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-2">Pearson r · numeric columns only</p>
      <Plot
        data={[{
          type: 'heatmap',
          z, x: cols, y: cols,
          colorscale: 'RdBu', zmin: -1, zmax: 1,
          text, texttemplate: '%{text}',
          showscale: true,
          colorbar: { thickness: 10, len: 0.85, tickfont: { size: 10 } },
        }]}
        layout={{
          margin: { t: 8, b: 70, l: 90, r: 20 },
          height: 240 + cols.length * 20,
          xaxis: { tickfont: { size: 11 }, side: 'bottom' },
          yaxis: { tickfont: { size: 11 }, autorange: 'reversed' },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
      />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HealthDashboard({ profile, onProceed, onLab, onReset }) {
  if (!profile) return null
  const { summary, insights, abnormal_columns, correlation_matrix, missing_value_matrix } = profile

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-100">
      <Sidebar activeItem="health" actions={{ onReset, onProceed, onLab }} />

      {/* Main scrollable area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top nav bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-800">DataGrid</span>
            <span className="text-slate-300">|</span>
            <span>Health Report</span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-600 font-medium">Phase 2</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadReport(profile, 'dataset')}
              className="border border-slate-200 hover:border-slate-300 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export Report
            </button>
            <button
              onClick={onProceed}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              Start Analysis →
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* Page title */}
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Data Health Report <span className="text-slate-400 font-normal">/ Phase 2</span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Automated Exploratory Data Analysis & Quality Audit</p>
          </div>

          {/* Summary chips */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Rows',           value: summary.rows.toLocaleString(),       warn: false },
              { label: 'Columns',        value: summary.columns,                     warn: false },
              { label: 'Null Rate',      value: `${summary.null_rate_pct}%`,         warn: summary.null_rate_pct > 5 },
              { label: 'Outliers',       value: summary.outliers_flagged,            warn: summary.outliers_flagged > 0 },
            ].map(({ label, value, warn }) => (
              <div key={label} className={`bg-white rounded-xl border px-4 py-3 text-center ${warn ? 'border-amber-200' : 'border-slate-200'}`}>
                <p className={`text-2xl font-bold ${warn ? 'text-amber-500' : 'text-slate-800'}`}>{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Row 1: Insights + Alerts */}
          <div className="grid grid-cols-5 gap-5">
            <div className="col-span-3">
              <ClaudeInsights insights={insights} />
            </div>
            <div className="col-span-2">
              <QualityAlerts abnormalColumns={abnormal_columns} fixes={insights?.fixes} />
            </div>
          </div>

          {/* Row 2: Flagged columns (only if any) */}
          {abnormal_columns?.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                Flagged Columns ({abnormal_columns.length})
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {abnormal_columns.map((col) => (
                  <FlaggedColumnCard key={col.name} col={col} />
                ))}
              </div>
            </div>
          )}

          {/* Row 3: Missing heatmap + Column distribution */}
          <div className="grid grid-cols-2 gap-5">
            <MissingValuesChart matrix={missing_value_matrix} totalRows={summary.rows} />
            <ColumnDistribution abnormalColumns={abnormal_columns} />
          </div>

          {/* Row 3: Correlation matrix */}
          <CorrelationMatrix matrix={correlation_matrix} />

        </div>
      </div>
    </div>
  )
}
