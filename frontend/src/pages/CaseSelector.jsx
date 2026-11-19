import { useMemo, useState } from "react";

export default function CaseSelector({ scenarios, localCases = [], loading, loadError, onReload, onStart, onEdit, onBack, title = "Кейси" }) {
  const [selectedField, setSelectedField] = useState("all");
  const fields = useMemo(() => [...new Set(scenarios.map((item) => item.field).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk")), [scenarios]);
  const visibleScenarios = selectedField === "all" ? scenarios : scenarios.filter((item) => item.field === selectedField);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">Інтерактив</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">{title}</h1>
        </div>
        <button type="button" onClick={onBack} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300 hover:border-olive-500">На головну</button>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-4 border-olive-500 bg-zinc-900/80 px-4 py-4">
        <p className="text-sm leading-6 text-zinc-300" aria-live="polite">
          {loading ? "Відкриваємо список кейсів." : loadError || "Публічні кейси відкриті без реєстрації. Час обмежений лише якщо організатор задав таймер. Гість не залишає запису, обліковий запис зберігає розбір."}
        </p>
        <button type="button" onClick={onReload} disabled={loading} className="shrink-0 border border-olive-700 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-olive-200 hover:border-olive-500 disabled:cursor-wait disabled:opacity-50">
          {loading ? "Завантаження…" : "Оновити список"}
        </button>
      </div>
      {scenarios.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">Доступно кейсів: {visibleScenarios.length}</p>
          {fields.length > 0 ? (
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <span>Напрямок</span>
              <select value={selectedField} onChange={(event) => setSelectedField(event.target.value)} className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-olive-500">
                <option value="all">Усі напрямки</option>
                {fields.map((field) => <option key={field} value={field}>{field}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      {scenarios.length === 0 && !loading ? (
        <p className="mt-6 border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-400">{loadError || "Поки немає доступних кейсів."}</p>
      ) : loading ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-3" aria-label="Завантаження кейсів" aria-busy="true">
          {[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse border border-zinc-800 bg-zinc-900/70" />)}
        </div>
      ) : visibleScenarios.length === 0 ? (
        <p className="mt-5 border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-400">У цьому напрямку поки немає кейсів.</p>
      ) : (
        <div className="mt-5 grid auto-rows-fr gap-4 lg:grid-cols-3">
          {visibleScenarios.map((item) => (
            <article key={item.id} className="flex h-full flex-col border border-olive-900 border-l-4 border-l-olive-500 bg-zinc-900/80 p-5 transition-colors hover:border-olive-700">
              <div className="flex items-center justify-between gap-3">
                <span className="border border-olive-700 bg-olive-950 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">Кейс</span>
                <p className="text-right font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{item.field}</p>
              </div>
              <h2 className="mt-2 font-display text-3xl leading-tight tracking-wide text-zinc-50">{item.title}</h2>
              <p className="mt-3 flex-1 pb-2 text-sm leading-6 text-zinc-400">{item.summary}</p>
              <p className="mt-3 border-t border-zinc-800 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Кроків: {item.steps?.length || 0}</p>
              <button type="button" onClick={() => onStart(item.id)} className="mt-4 min-h-12 w-full border border-olive-600 bg-olive-800 px-4 py-3 text-left font-display text-xl tracking-[0.04em] text-olive-100 transition-colors hover:border-olive-400 hover:bg-olive-700">Почати проходження</button>
            </article>
          ))}
        </div>
      )}
      {localCases.length > 0 ? (
        <div className="mt-8">
          <h2 className="font-display text-3xl text-zinc-50">Мої кейси</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {localCases.map((item) => (
              <article key={item.id} className="flex h-full flex-col border border-zinc-800 bg-zinc-950 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{item.status === "published" ? "Публічний" : item.status === "pending" ? "На розгляді" : item.status === "rejected" ? "Приховано модерацією" : "Локальний"}</p>
                <h3 className="mt-2 font-display text-3xl text-zinc-50">{item.title}</h3>
                <p className="mt-3 flex-1 pb-2 text-sm leading-6 text-zinc-400">{item.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                  <button type="button" onClick={() => onStart(item.id)} className="border border-zinc-600 px-4 py-3 text-left font-display text-xl text-zinc-100 hover:border-olive-500">Пройти</button>
                  {onEdit ? <button type="button" onClick={() => onEdit(item)} className="border border-olive-700 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-olive-200 hover:border-olive-500">Редагувати</button> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
