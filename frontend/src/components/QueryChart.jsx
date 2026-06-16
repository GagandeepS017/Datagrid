import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const COLORS = ['#3b82f6','#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#14b8a6','#f97316','#84cc16']

function truncate(val, max = 14) {
  return String(val ?? '').slice(0, max) + (String(val ?? '').length > max ? '…' : '')
}

function isNumericCol(rows, colIdx) {
  return rows.slice(0, 10).some(r => r[colIdx] !== null && !isNaN(parseFloat(r[colIdx])))
}

// Resolve chart spec: prefer API-provided spec, fall back to shape-based detection
function resolveSpec(chart, columns, rows) {
  // Try API spec first — verify both columns exist in the result
  if (chart && chart.type && chart.x && chart.y) {
    const xi = columns.indexOf(chart.x)
    const yi = columns.indexOf(chart.y)
    if (xi !== -1 && yi !== -1) return { type: chart.type, xi, yi, x: chart.x, y: chart.y }
  }

  // Auto-detect: need exactly 2 columns, second must be numeric
  if (columns.length === 2 && rows.length >= 2) {
    if (isNumericCol(rows, 1)) {
      const type = rows.length <= 10 ? 'bar' : 'bar'
      return { type, xi: 0, yi: 1, x: columns[0], y: columns[1] }
    }
    if (isNumericCol(rows, 0)) {
      return { type: 'bar', xi: 1, yi: 0, x: columns[1], y: columns[0] }
    }
  }

  return null
}

export default function QueryChart({ chart, columns, rows }) {
  if (!columns?.length || !rows?.length || rows.length < 2) return null

  const spec = resolveSpec(chart, columns, rows)
  if (!spec) return null

  const data = rows.map((r) => ({
    label: truncate(r[spec.xi]),
    y: typeof r[spec.yi] === 'number' ? r[spec.yi] : parseFloat(r[spec.yi]) || 0,
  }))

  const fmt = (v) => (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : v)

  const title = (
    <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">
      {spec.y} by {spec.x}
    </p>
  )

  if (spec.type === 'line') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        {title}
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmt} width={56} />
            <Tooltip formatter={(v) => [fmt(v), spec.y]} labelFormatter={(l) => `${spec.x}: ${l}`} />
            <Line type="monotone" dataKey="y" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (spec.type === 'pie' && rows.length <= 10) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">
          {spec.y} distribution
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="y" nameKey="label" cx="50%" cy="50%" outerRadius={80}
              label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => [fmt(v), spec.y]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Default: bar chart
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      {title}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmt} width={56} />
          <Tooltip formatter={(v) => [fmt(v), spec.y]} labelFormatter={(l) => `${spec.x}: ${l}`} />
          <Bar dataKey="y" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
