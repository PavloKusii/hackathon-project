import { METRICS } from "../components/MetricsGauges";

export default function Results({ attempts, onOpen, onBack }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">Особистий кабінет</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">Результати</h1>
        </div>
        <button type="button" onClick={onBack} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300">На головну</button>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">Кожне збережене проходження відкривається з вашими відповідями, поясненнями і позначками слабших рішень. Організатор групового заняття цих записів не бачить.</p>
      <div className="mt-6 flex flex-col gap-3">
        {attempts.length === 0 ? <p className="text-sm text-zinc-400">Завершіть кейс увійшовши в обліковий запис, і розбір з’явиться тут.</p> : null}
        {attempts.map((item) => (
          <button key={item.id} type="button" onClick={() => onOpen(item)} className="border border-zinc-800 bg-zinc-900/80 p-5 text-left hover:border-olive-500">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-400">{item.scenarioCode} · {item.mode === "group" ? "група" : "самостійно"}</p>
            <h2 className="mt-2 font-display text-3xl text-zinc-50">{item.scenarioTitle}</h2>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{new Date(item.createdAt).toLocaleString("uk-UA")}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {METRICS.map((metric) => (
                <span key={metric.key} className="font-mono text-xs text-olive-300">{metric.short} {item.scores?.[metric.key] ?? 0}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
