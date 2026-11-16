export default function ActionCard({ index, option, selected, collapsed, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.id)}
      aria-pressed={selected}
      tabIndex={collapsed ? -1 : 0}
      aria-hidden={collapsed}
      className={`action-card group w-full border px-4 py-4 text-left sm:px-5 ${collapsed ? "is-out" : ""} ${selected ? "border-olive-500 bg-zinc-900" : "border-zinc-700 bg-zinc-900/80 hover:border-olive-500"}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className={`grid h-8 w-8 place-items-center border ${selected ? "border-olive-500 text-olive-300" : "border-zinc-600 text-zinc-500 group-hover:border-olive-500"}`}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              {selected ? (
                <path d="M3 8.2 6.2 11.4 13 4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
              ) : (
                <rect x="3.2" y="3.2" width="9.6" height="9.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
              )}
            </svg>
          </span>
          <span className="font-mono text-xs text-olive-400">{String(index + 1).padStart(2, "0")}</span>
        </span>
        <span className="flex flex-1 flex-wrap justify-end gap-2">
          {(option.badges || []).map((badge) => (
            <span key={badge} className="border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
              {badge}
            </span>
          ))}
        </span>
      </span>
      <span className="mt-3 block font-display text-2xl tracking-wide text-zinc-50">{option.title}</span>
      <span className="mt-2 block text-sm leading-6 text-zinc-400">{option.text}</span>
    </button>
  );
}
