const Icon = {
  upload:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  health:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  analysis: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  lab:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11l-4 4a2 2 0 0 0 1.4 3.4H17.6A2 2 0 0 0 19 18l-4-4V3"/></svg>,
  export:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
}

// activeItem: 'upload' | 'health' | 'analysis'
// actions: { onReset, onProceed, onHealth }
export default function Sidebar({ activeItem = 'upload', actions = {} }) {
  const { onReset, onProceed, onHealth, onLab } = actions

  const primary = [
    { key: 'upload',   label: 'Upload',   action: onReset },
    { key: 'health',   label: 'Health',   action: onHealth ?? null },
    { key: 'analysis', label: 'Analysis', action: onProceed ?? null },
    { key: 'lab',      label: 'Lab',      action: onLab ?? null },
  ]

  const NavItem = ({ item }) => {
    const isActive = item.key === activeItem
    return (
      <button
        onClick={item.action ?? undefined}
        disabled={!item.action && !isActive}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
          ${isActive
            ? 'bg-blue-600 text-white'
            : item.action
              ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
              : 'text-slate-600 cursor-default'
          }`}
      >
        {Icon[item.key]}
        <span className="uppercase tracking-wide text-xs">{item.label}</span>
      </button>
    )
  }

  return (
    <aside className="w-56 shrink-0 bg-slate-900 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">DataGrid</p>
          <p className="text-slate-500 text-xs">V1.0.0</p>
        </div>
      </div>

      {/* New Analysis */}
      <div className="px-4 pb-5">
        <button
          onClick={onReset}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-base leading-none">+</span> New Analysis
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {primary.map((item) => <NavItem key={item.key} item={item} />)}
      </nav>
    </aside>
  )
}
