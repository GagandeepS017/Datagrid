export default function SchemaInfo({ table }) {
  const TYPE_COLORS = {
    numeric: 'bg-blue-100 text-blue-700',
    text: 'bg-slate-100 text-slate-600',
    datetime: 'bg-purple-100 text-purple-700',
    boolean: 'bg-green-100 text-green-700',
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Uploaded dataset</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {table.row_count.toLocaleString()} rows · {table.columns.length} columns
          </p>
        </div>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
          Ready
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {table.columns.map((col) => (
          <span
            key={col.name}
            className={`text-xs px-2 py-1 rounded-full font-medium ${TYPE_COLORS[col.type] ?? TYPE_COLORS.text}`}
            title={col.dtype}
          >
            {col.name}
          </span>
        ))}
      </div>
    </div>
  )
}
