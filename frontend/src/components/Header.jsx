export default function Header({ screen, onNavigate }) {
  const casesOn = screen === "cases" || screen === "simulation" || screen === "debrief";
  const normsOn = screen === "library";
  return (
    <header>
      <div className="border-b border-olive-800 bg-olive-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-olive-300 sm:px-6">
          <span>EG-TRN · навчальний контур</span>
          <span className="hidden sm:inline">Симулятор етичних дилем</span>
        </div>
      </div>
      <div className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => onNavigate("dashboard")} className="flex min-w-0 items-center gap-3 text-left">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-olive-700 bg-olive-950 font-mono text-[11px] text-olive-300">EG</span>
            <span className="min-w-0">
              <span className="block truncate font-display text-xl tracking-[0.16em] text-zinc-100">ETHICAL GUARD</span>
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Тактичний тренажер</span>
            </span>
          </button>
          <nav className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => onNavigate("cases")} className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-olive-500 ${casesOn ? "border-olive-500 bg-olive-950 text-olive-200" : "border-zinc-800 text-zinc-400"}`}>Кейси</button>
            <button type="button" onClick={() => onNavigate("library")} className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-amber-600 ${normsOn ? "border-amber-600 bg-zinc-900 text-amber-300" : "border-zinc-800 text-zinc-400"}`}>Норми</button>
          </nav>
        </div>
      </div>
    </header>
  );
}
