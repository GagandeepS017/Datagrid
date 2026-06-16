import { useRef, useState } from 'react'
import axios from 'axios'
import Sidebar from './Sidebar'

export default function FileUpload({ onUploadSuccess }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const inputRef = useRef(null)

  const ACCEPTED_EXTS = ['.csv', '.xlsx', '.xls', '.json', '.png', '.jpg', '.jpeg', '.webp', '.gif']

  const handleFile = async (file) => {
    if (!file) return
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
    if (!ACCEPTED_EXTS.includes(ext)) {
      setError(`Unsupported file type "${ext}". Accepted: CSV, Excel, JSON, PNG, JPG, WEBP.`)
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
            {/* Notification */}
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>
            {/* Settings */}
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              G
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">

          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">
              New Analysis <span className="text-slate-400 font-normal">/ Upload</span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Upload your dataset to begin automated profiling and AI-powered querying</p>
          </div>

          {/* Upload zone + info side-by-side */}
          <div className="grid grid-cols-5 gap-6 max-w-5xl">

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
                  accept=".csv,.xlsx,.xls,.json,.png,.jpg,.jpeg,.webp,.gif"
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
                    {/* Upload icon */}
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={1.5} className="w-8 h-8">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p className="text-slate-700 font-semibold text-lg mb-1">
                      Drop your file here
                    </p>
                    <p className="text-slate-400 text-sm mb-5">or click to browse files</p>
                    <span className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
                      Browse Files
                    </span>
                    <p className="text-slate-300 text-xs mt-4">Max 50 MB · CSV, Excel, JSON, or Image</p>
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
                    { n: '01', label: 'Schema inference',   desc: 'Column types and sample rows extracted automatically' },
                    { n: '02', label: 'Health Report',      desc: 'Outliers, nulls, skewness, and correlations profiled' },
                    { n: '03', label: 'Claude Insights',    desc: '3–5 plain-English observations generated by AI' },
                    { n: '04', label: 'Query interface',    desc: 'Ask anything in natural language — Claude writes the SQL' },
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
                  {['CSV', 'Excel (.xlsx)', 'JSON', 'PNG', 'JPG', 'WEBP'].map((tag) => (
                    <span key={tag} className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg font-medium">{tag}</span>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-3">Images use Claude Vision OCR to extract tables</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
