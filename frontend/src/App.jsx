import { useState } from 'react'
import axios from 'axios'
import FileUpload from './components/FileUpload'
import SchemaInfo from './components/SchemaInfo'
import QueryChat from './components/QueryChat'
import HealthDashboard from './components/HealthDashboard'
import Sidebar from './components/Sidebar'

// App moves through three stages:
//   'upload'    → FileUpload
//   'profiling' → loading spinner (calling /api/profile)
//   'dashboard' → HealthDashboard (user clicks "Explore Data →")
//   'query'     → SchemaInfo + QueryChat

export default function App() {
  const [stage, setStage] = useState('upload')
  const [table, setTable] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)

  // Called by FileUpload once /api/upload succeeds
  const handleUploadSuccess = async (uploadData) => {
    setTable(uploadData)
    setStage('profiling')
    setProfileError(null)

    try {
      const { data } = await axios.post('/api/profile', { table_id: uploadData.table_id })
      setProfile(data)
      setStage('dashboard')
    } catch (err) {
      // Profiling failed — skip dashboard and go straight to query
      setProfileError(err.response?.data?.detail ?? 'Profiling failed.')
      setStage('query')
    }
  }

  const handleReset = () => {
    setStage('upload')
    setTable(null)
    setProfile(null)
    setProfileError(null)
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  if (stage === 'upload') {
    return <FileUpload onUploadSuccess={handleUploadSuccess} />
  }

  // ── Profiling spinner ────────────────────────────────────────────────────────
  if (stage === 'profiling') {
    return (
      <div className="flex h-full w-full overflow-hidden bg-slate-100">
        <Sidebar activeItem="health" actions={{ onReset: handleReset }} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-slate-700 font-medium">Analysing your dataset…</p>
            <p className="text-slate-400 text-sm mt-1">Computing distributions, outliers, and correlations</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Health dashboard ─────────────────────────────────────────────────────────
  if (stage === 'dashboard') {
    return (
      <HealthDashboard
        profile={profile}
        onProceed={() => setStage('query')}
        onReset={handleReset}
      />
    )
  }

  // ── Query interface ──────────────────────────────────────────────────────────
  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">DataGrid</h1>
        <div className="flex items-center gap-4">
          {profile && (
            <button
              onClick={() => setStage('dashboard')}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              View Health Report
            </button>
          )}
          <button
            onClick={handleReset}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Upload new file
          </button>
        </div>
      </header>

      {profileError && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-700">
          Profiling skipped: {profileError}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden max-w-6xl w-full mx-auto px-4 py-6 gap-6">
        <aside className="w-72 shrink-0">
          <SchemaInfo table={table} />
        </aside>
        <main className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden">
          <QueryChat tableId={table.table_id} />
        </main>
      </div>
    </div>
  )
}
