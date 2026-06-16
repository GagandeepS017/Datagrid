import { useState } from 'react'
import axios from 'axios'
import FileUpload from './components/FileUpload'
import SchemaInfo from './components/SchemaInfo'
import QueryChat from './components/QueryChat'
import HealthDashboard from './components/HealthDashboard'
import LabPanel from './components/LabPanel'
import Sidebar from './components/Sidebar'

export default function App() {
  const [stage, setStage] = useState('upload')
  const [table, setTable] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [queryHistory, setQueryHistory] = useState([])
  const [labState, setLabState] = useState({
    tab:       'synthetic',
    synthetic: { nRows: 100, result: null, error: null },
    whatif:    { scenario: '', result: null, error: null, showSql: false },
  })

  const handleUploadSuccess = async (uploadData) => {
    setTable(uploadData)
    setStage('profiling')
    setProfileError(null)
    try {
      const { data } = await axios.post('/api/profile', { table_id: uploadData.table_id })
      setProfile(data)
      setStage('dashboard')
    } catch (err) {
      setProfileError(err.response?.data?.detail ?? 'Profiling failed.')
      setStage('query')
    }
  }

  const handleReset = () => {
    setStage('upload')
    setTable(null)
    setProfile(null)
    setProfileError(null)
    setQueryHistory([])
    setLabState({
      tab:       'synthetic',
      synthetic: { nRows: 100, result: null, error: null },
      whatif:    { scenario: '', result: null, error: null, showSql: false },
    })
  }

  // Sidebar actions shared across all post-upload stages
  const nav = {
    onReset:   handleReset,
    onHealth:  profile ? () => setStage('dashboard') : null,
    onProceed: table   ? () => setStage('query')     : null,
    onLab:     table   ? () => setStage('lab')       : null,
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  if (stage === 'upload') {
    return <FileUpload onUploadSuccess={handleUploadSuccess} />
  }

  // ── Profiling spinner ─────────────────────────────────────────────────────
  if (stage === 'profiling') {
    return (
      <div className="flex h-full w-full overflow-hidden bg-slate-100">
        <Sidebar activeItem="health" actions={nav} />
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

  // ── Health dashboard ──────────────────────────────────────────────────────
  if (stage === 'dashboard') {
    return (
      <HealthDashboard
        profile={profile}
        onProceed={() => setStage('query')}
        onLab={() => setStage('lab')}
        onReset={handleReset}
      />
    )
  }

  // ── Shared content wrapper (query + lab) ──────────────────────────────────
  const ContentShell = ({ active, children }) => (
    <div className="flex h-full w-full overflow-hidden bg-slate-100">
      <Sidebar activeItem={active} actions={nav} />
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        <aside className="w-64 shrink-0 flex flex-col gap-3">
          <SchemaInfo table={table} />
          {profileError && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
              Profiling skipped: {profileError}
            </div>
          )}
        </aside>
        <main className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )

  const handleApplyResult = (uploadData) => {
    setTable(uploadData)
    setQueryHistory([])
    setStage('query')
  }

  // ── Lab ───────────────────────────────────────────────────────────────────
  if (stage === 'lab') {
    return (
      <ContentShell active="lab">
        <LabPanel table={table} labState={labState} setLabState={setLabState} onApplyResult={handleApplyResult} />
      </ContentShell>
    )
  }

  // ── Query ─────────────────────────────────────────────────────────────────
  return (
    <ContentShell active="analysis">
      <QueryChat tableId={table.table_id} history={queryHistory} setHistory={setQueryHistory} />
    </ContentShell>
  )
}
