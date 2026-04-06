import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ResultTable from './ResultTable'

export default function QueryChat({ tableId }) {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
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
      setHistory((h) =>
        h.map((item) =>
          item.id === pending.id
            ? { ...item, status: 'ok', sql: data.sql, columns: data.columns, rows: data.rows, row_count: data.row_count }
            : item
        )
      )
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Query failed. Please try rephrasing.'
      setHistory((h) =>
        h.map((item) => (item.id === pending.id ? { ...item, status: 'error', error: detail } : item))
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message history */}
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
            {/* Question bubble */}
            <div className="flex justify-end">
              <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm">
                {item.question}
              </div>
            </div>

            {/* Answer */}
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
                <ResultTable columns={item.columns} rows={item.rows} />
                <details className="group">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                    View SQL
                  </summary>
                  <pre className="mt-1 text-xs bg-slate-900 text-slate-200 rounded-lg p-3 overflow-x-auto">
                    {item.sql}
                  </pre>
                </details>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={submit} className="flex gap-2 pt-3 border-t border-slate-200">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your data…"
          disabled={loading}
          className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
        >
          Ask
        </button>
      </form>
    </div>
  )
}
