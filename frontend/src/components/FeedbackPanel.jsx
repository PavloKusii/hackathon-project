import { METRICS } from "./MetricsGauges";

function signed(value) {
  const number = Number(value) || 0;
  return number > 0 ? `+${number}` : String(number);
}

function tone(value) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-amber-400";
  return "text-zinc-500";
}

export default function FeedbackPanel({ option, last, onNext }) {
  if (!option) return null;
  return (
    <section id="feedback" className="rise mt-4 border border-olive-700 bg-zinc-900 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-olive-300">Миттєвий розбір</p>
      <h2 className="mt-2 font-display text-3xl tracking-wide text-zinc-50">Аналіз кроку</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-300">{option.analysis}</p>
      {option.deferred ? (
        <div className="mt-4 border border-zinc-800 bg-zinc-950 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Відкладені наслідки</p>
          <p className="mt-2 text-sm leading-7 text-zinc-300">{option.deferred}</p>
        </div>
      ) : null}
      <div className="mt-4 border border-zinc-800 bg-zinc-950 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-500">Правове обґрунтування</p>
        <p className="mt-2 text-sm leading-7 text-zinc-300">{option.legal}</p>
        {Array.isArray(option.legalRefs) && option.legalRefs.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {option.legalRefs.map((item) => (
              <li key={item.href || item.title}>
                <a className="text-sm text-amber-500/90 underline decoration-zinc-700 underline-offset-4 hover:text-amber-400" href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Зміна шкал</span>
        {METRICS.map((metric) => {
          const value = Number(option.deltas?.[metric.key] || 0);
          return (
            <span key={metric.key} className={`font-mono text-xs ${tone(value)}`}>
              {metric.short} {signed(value)}
            </span>
          );
        })}
      </div>
      {onNext ? (
        <button type="button" onClick={onNext} className="mt-5 border border-olive-600 bg-olive-800 px-5 py-3 font-display text-xl tracking-[0.12em] text-olive-100 hover:border-olive-500 hover:bg-olive-700">
          {last ? "До підсумку" : "Наступний крок"}
        </button>
      ) : null}
    </section>
  );
}
