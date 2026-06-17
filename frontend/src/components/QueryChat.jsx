import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ResultTable from './ResultTable'
import QueryChart from './QueryChart'

function downloadCsv(columns, rows) {
  const esc = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }
  const lines = [columns.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `query_${Date.now()}.csv`; a.click()
  URL.revokeObjectURL(url)
}

async function downloadExcel(columns, rows) {
  const { data } = await axios.post('/api/export/excel', { columns, rows, filename: `query_${Date.now()}` }, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a'); a.href = url; a.download = `query_${Date.now()}.xlsx`; a.click()
  URL.revokeObjectURL(url)
}

async function streamInterpretation(question, columns, rows, onToken, onDone) {
  try {
    const res = await fetch('/api/query/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, columns, rows: rows.slice(0, 10) }),
    })
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value).split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') { onDone(); return }
        try { const { token } = JSON.parse(payload); if (token) onToken(token) } catch {}
      }
    }
  } catch {}
  onDone()
}

export default function QueryChat({ tableId, history, setHistory }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const submit = async (e) => {
    e.preventDefault()
    const q = question.trim()
    if (!q || loading) return

    setQuestion('')
    setLoading(true)
    const pending = { id: Date.now(), question: q, status: 'loading' }
    setHistory((h) => [...h, pending])

    try {
      const { data } = await axios.post('/api/query', { table_id: tableId, question: q })
      const entry = {
        ...pending,
        status: 'ok',
        sql: data.sql, columns: data.columns, rows: data.rows,
        row_count: data.row_count, chart: data.chart,
        interpretation: '', interpreting: true,
      }
      setHistory((h) => h.map((item) => item.id === pending.id ? entry : item))

      // Stream interpretation
      streamInterpretation(
        q, data.columns, data.rows,
        (token) => setHistory((h) => h.map((item) =>
          item.id === pending.id ? { ...item, interpretation: (item.interpretation ?? '') + token } : item
        )),
        () => setHistory((h) => h.map((item) =>
          item.id === pending.id ? { ...item, interpreting: false } : item
        )),
      )
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Query failed. Please try rephrasing.'
      setHistory((h) => h.map((item) => item.id === pending.id ? { ...item, status: 'error', error: detail } : item))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-6 pb-4">
        {history.length === 0 && (
          <div className="text-center text-slate-400 py-16">
            <p className="text-2xl mb-2">💬</p>
            <p className="text-sm">Ask anything about your data</p>
            <p className="text-xs mt-1 text-slate-300">e.g. "What is the average salary by department?"</p>
          </div>
        )}

        {history.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className="flex justify-end">
              <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm">
                {item.question}
              </div>
            </div>

            {item.status === 'loading' && (
              <div className="flex items-center gap-2 text-slate-400 text-sm pl-1">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                Thinking…
              </div>
            )}

            {item.status === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {item.error}
              </div>
            )}

            {item.status === 'ok' && (
              <div className="space-y-2">
                <QueryChart chart={item.chart} columns={item.columns} rows={item.rows} />
                <ResultTable columns={item.columns} rows={item.rows} />

                {/* Streaming interpretation */}
                {(item.interpretation || item.interpreting) && (
                  <div className="flex gap-2 items-start px-1">
                    <span className="text-blue-500 mt-0.5 shrink-0 text-xs">✦</span>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {item.interpretation}
                      {item.interpreting && (
                        <span className="inline-block w-1.5 h-3.5 bg-blue-400 ml-0.5 align-middle animate-pulse rounded-sm" />
                      )}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button onClick={() => downloadCsv(item.columns, item.rows)} className="text-xs text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    CSV
                  </button>
                  <button onClick={() => downloadExcel(item.columns, item.rows)} className="text-xs text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Excel
                  </button>
                  <details className="group inline">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none list-none">SQL ▾</summary>
                    <pre className="mt-1 text-xs bg-slate-900 text-slate-200 rounded-lg p-3 overflow-x-auto">{item.sql}</pre>
                  </details>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 pt-3 border-t border-slate-200">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your data…"
          disabled={loading}
          className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
        <button type="submit" disabled={loading || !question.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors">
          Ask
        </button>
      </form>
    </div>
  )
}
