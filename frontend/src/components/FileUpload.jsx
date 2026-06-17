import { useRef, useState, useEffect } from 'react'
import axios from 'axios'
import Sidebar from './Sidebar'

const SAMPLE_ICONS = { retail_sales: '🛍️', hr_employees: '👥', ecommerce_orders: '📦' }

export default function FileUpload({ onUploadSuccess }) {
  const [dragging, setDragging]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [loadingId, setLoadingId] = useState(null)
  const [error, setError]         = useState(null)
  const [samples, setSamples]     = useState([])
  const [recent, setRecent]       = useState([])
  const inputRef = useRef(null)

  const ACCEPTED_EXTS = ['.csv', '.xlsx', '.xls', '.json']

  useEffect(() => {
    axios.get('/api/samples').then(r => setSamples(r.data)).catch(() => {})
    axios.get('/api/tables').then(r => setRecent(r.data)).catch(() => {})
  }, [])

  const handleFile = async (file) => {
    if (!file) return
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
    if (!ACCEPTED_EXTS.includes(ext)) {
      setError(`Unsupported file type "${ext}". Accepted: CSV, Excel, JSON.`)
      return
    }
    setError(null)
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const { data } = await axios.post('/api/upload', formData)
      onUploadSuccess(data)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadSample = async (sampleId) => {
    setLoadingId(sampleId)
    setError(null)
    try {
      const { data } = await axios.post(`/api/samples/${sampleId}`)
      onUploadSuccess(data)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to load sample dataset.')
    } finally {
      setLoadingId(null)
    }
  }

  const reloadRecent = async (tableId, filename) => {
    setLoadingId(tableId)
    setError(null)
    try {
      const { data } = await axios.get(`/api/schema/${tableId}`)
      onUploadSuccess({ ...data, table_id: tableId })
    } catch (err) {
      setError(`Could not reload "${filename}". Try re-uploading.`)
    } finally {
      setLoadingId(null)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-100">
      <Sidebar activeItem="upload" actions={{}} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top nav */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-800">DataGrid</span>
            <span className="text-slate-300">|</span>
            <span>New Analysis</span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-600 font-medium">Upload</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              G
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">
              New Analysis <span className="text-slate-400 font-normal">/ Upload</span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Upload your dataset to begin automated profiling and AI-powered querying</p>
          </div>

          {/* Upload zone + info */}
          <div className="grid grid-cols-5 gap-6 max-w-5xl mb-8">

            {/* Drop zone */}
            <div className="col-span-3">
              <div
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
                  dragging
                    ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                    : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'
                }`}
                onClick={() => !loading && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])}
                />

                {loading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div>
                      <p className="text-slate-700 font-semibold">Uploading & parsing…</p>
                      <p className="text-slate-400 text-sm mt-1">Detecting schema and loading into DuckDB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.5} className="w-8 h-8">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p className="text-slate-700 font-semibold text-lg mb-1">Drop your file here</p>
                    <p className="text-slate-400 text-sm mb-5">or click to browse files</p>
                    <span className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
                      Browse Files
                    </span>
                    <p className="text-slate-300 text-xs mt-4">Max 50 MB · CSV, Excel, or JSON</p>
                  </>
                )}
              </div>

              {error && (
                <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}
            </div>

            {/* Info panel */}
            <div className="col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">What happens next</h3>
                <ol className="space-y-3">
                  {[
                    { n: '01', label: 'Schema inference',  desc: 'Column types and sample rows extracted automatically' },
                    { n: '02', label: 'Health Report',     desc: 'Outliers, nulls, skewness, and correlations profiled' },
                    { n: '03', label: 'Claude Insights',   desc: '3-5 plain-English observations generated by AI' },
                    { n: '04', label: 'Query interface',   desc: 'Ask anything in natural language and Claude writes the SQL' },
                  ].map(({ n, label, desc }) => (
                    <li key={n} className="flex gap-3">
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 shrink-0 h-fit mt-0.5">{n}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="bg-slate-900 rounded-2xl p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Supported formats</p>
                <div className="flex flex-wrap gap-2">
                  {['CSV', 'Excel (.xlsx)', 'JSON'].map((tag) => (
                    <span key={tag} className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg font-medium">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent datasets */}
          {recent.length > 0 && (
            <div className="max-w-5xl mb-8">
              <h2 className="text-base font-semibold text-slate-700 mb-4">Recent datasets</h2>
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                {recent.slice(0, 5).map((t) => (
                  <button
                    key={t.table_id}
                    onClick={() => reloadRecent(t.table_id, t.filename)}
                    disabled={!!loadingId}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={1.8} className="w-4 h-4">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-medium text-slate-700 truncate">{t.filename}</p>
                        <p className="text-xs text-slate-400">{t.row_count?.toLocaleString()} rows · {t.columns?.length} columns</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-xs text-slate-300">{t.uploaded_at ? new Date(t.uploaded_at).toLocaleDateString() : ''}</span>
                      {loadingId === t.table_id ? (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                          className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sample datasets */}
          {samples.length > 0 && (
            <div className="max-w-5xl mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-base font-semibold text-slate-700">Try a sample dataset</h2>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">No upload needed</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {samples.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSample(s.id)}
                    disabled={!!loadingId}
                    className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md p-5 text-left transition-all disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-2xl">{SAMPLE_ICONS[s.id] ?? '📊'}</span>
                      {loadingId === s.id ? (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mt-1" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                          className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors mt-1">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mb-1">{s.name}</p>
                    <p className="text-xs text-slate-400 mb-3 leading-snug">{s.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium">{s.rows.toLocaleString()} rows</span>
                      {s.tags?.map((t) => (
                        <span key={t} className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded font-medium">{t}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
