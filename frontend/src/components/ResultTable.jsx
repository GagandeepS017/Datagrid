export default function ResultTable({ columns, rows }) {
  if (!columns?.length) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 text-slate-700 whitespace-nowrap">
                  {cell === null || cell === undefined ? (
                    <span className="text-slate-300 italic">null</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 px-4 py-2 border-t border-slate-100">
        {rows.length} row{rows.length !== 1 ? 's' : ''} returned
      </p>
    </div>
  )
}
