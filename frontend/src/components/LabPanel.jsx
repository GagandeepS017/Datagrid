import { useState } from 'react'
import axios from 'axios'
import ResultTable from './ResultTable'

function downloadCsv(columns, rows, filename) {
  const escape = (v) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function SyntheticTab({ tableId, tableName, state, setState }) {
  const [loading, setLoading] = useState(false)
  const { nRows, result, error } = state

  const set = (patch) => setState((s) => ({ ...s, synthetic: { ...s.synthetic, ...patch } }))

  const generate = async () => {
    setLoading(true); set({ error: null, result: null })
    try {
      const { data } = await axios.post('/api/lab/synthetic', { table_id: tableId, n_rows: nRows })
      set({ result: data })
    } catch (err) {
      set({ error: err.response?.data?.detail ?? 'Generation failed.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Synthetic Data Generator</h2>
        <p className="text-sm text-slate-500 mt-1">
          Generate synthetic rows that statistically mirror your dataset — same distributions,
          value frequencies, and ranges. Safe to share; contains no real records.
        </p>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Rows to generate</label>
          <input
            type="number" min={1} max={10000}
            value={nRows}
            onChange={(e) => set({ nRows: Math.max(1, Math.min(10000, parseInt(e.target.value) || 1)) })}
            className="w-36 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={generate} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-5 py-2 text-sm font-medium transition-colors"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
        {result && (
          <button
            onClick={() => downloadCsv(result.columns, result.rows, `${tableName}_synthetic_${nRows}.csv`)}
            className="border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl px-5 py-2 text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download CSV
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {result && (
        <div>
          <p className="text-xs text-slate-400 mb-2">{result.rows.length} synthetic rows — preview (first 20 shown)</p>
          <ResultTable columns={result.columns} rows={result.rows.slice(0, 20)} />
        </div>
      )}
    </div>
  )
}

function WhatIfTab({ tableId, state, setState }) {
  const [loading, setLoading] = useState(false)
  const { scenario, result, error, showSql } = state

  const set = (patch) => setState((s) => ({ ...s, whatif: { ...s.whatif, ...patch } }))

  const run = async (e) => {
    e.preventDefault()
    if (!scenario.trim() || loading) return
    setLoading(true); set({ error: null, result: null })
    try {
      const { data } = await axios.post('/api/lab/whatif', { table_id: tableId, scenario })
      set({ result: data })
    } catch (err) {
      set({ error: err.response?.data?.detail ?? 'What-If analysis failed.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">What-If Simulator</h2>
        <p className="text-sm text-slate-500 mt-1">
          Describe a change in plain English. Claude will transform your data to simulate the scenario.
        </p>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-medium text-slate-500 mb-2">Example scenarios</p>
        <div className="flex flex-wrap gap-2">
          {[
            'What if all salaries increase by 15%?',
            'What if we double the quantity for orders above $500?',
            'What if the price column is discounted by 10% for all rows?',
          ].map((ex) => (
            <button
              key={ex} onClick={() => set({ scenario: ex })}
              className="text-xs bg-white border border-slate-200 hover:border-blue-400 text-slate-600 hover:text-blue-600 rounded-lg px-3 py-1.5 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={run} className="flex gap-2">
        <input
          value={scenario}
          onChange={(e) => set({ scenario: e.target.value })}
          placeholder="What if salaries increase by 20%?"
          disabled={loading}
          className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit" disabled={loading || !scenario.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
        >
          {loading ? 'Running…' : 'Run'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            {result.narrative}
          </div>
          <ResultTable columns={result.columns} rows={result.rows} />
          <details open={showSql} onToggle={(e) => set({ showSql: e.target.open })}>
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">View SQL</summary>
            <pre className="mt-1 text-xs bg-slate-900 text-slate-200 rounded-lg p-3 overflow-x-auto">{result.sql}</pre>
          </details>
        </div>
      )}
    </div>
  )
}

export default function LabPanel({ table, labState, setLabState }) {
  const tab = labState.tab
  const setTab = (t) => setLabState((s) => ({ ...s, tab: t }))

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex gap-1 mb-6 border-b border-slate-200 pb-0">
        {[
          { key: 'synthetic', label: 'Synthetic Data' },
          { key: 'whatif',    label: 'What-If'         },
        ].map(({ key, label }) => (
          <button
            key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'synthetic' && (
        <SyntheticTab
          tableId={table.table_id}
          tableName={table.table_name}
          state={labState.synthetic}
          setState={setLabState}
        />
      )}
      {tab === 'whatif' && (
        <WhatIfTab
          tableId={table.table_id}
          state={labState.whatif}
          setState={setLabState}
        />
      )}
    </div>
  )
}
