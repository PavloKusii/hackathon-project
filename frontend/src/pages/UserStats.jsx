import MetricsGauges, { METRICS } from "../components/MetricsGauges";
import { Legend, TrendChart } from "../components/Charts";

export default function UserStats({ user, attempts, onBack, onStart, onOpen }) {
  const completed = attempts || [];
  const avg = METRICS.reduce((out, metric) => ({
    ...out,
    [metric.key]: completed.length
      ? Math.round(completed.reduce((sum, item) => sum + (item.scores?.[metric.key] || 0), 0) / completed.length)
      : 0
  }), {});
  const trend = [...completed].slice(0, 8).reverse().map((item, index) => ({
    label: String(index + 1).padStart(2, "0"),
    integrity: item.scores?.integrity || 0,
    trust: item.scores?.trust || 0,
    effectiveness: item.scores?.effectiveness || 0
  }));
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[.2em] text-olive-400">Особистий кабінет</p>
          <h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">Статистика</h1>
          <p className="mt-2 text-sm text-zinc-400">{user ? `${user.login || user.email}` : "Увійдіть, щоб побачити збережені проходження"}</p>
        </div>
        <button type="button" onClick={onBack} className="border border-zinc-700 px-4 py-3 text-sm text-zinc-300">На головну</button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Проходжень", completed.length],
          ["Зроблено виборів", completed.reduce((sum, item) => sum + (item.history?.length || 0), 0)],
          ["Остання активність", completed[0] ? new Date(completed[0].createdAt).toLocaleDateString("uk-UA") : "—"]
        ].map(([label, value]) => (
          <article key={label} className="border border-zinc-800 bg-zinc-900/80 p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
            <p className="mt-2 font-display text-4xl text-white">{value}</p>
          </article>
        ))}
      </div>
      {completed.length ? (
        <section className="mt-4 border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-white">Середній баланс навичок</h2>
            <span className="font-mono text-xs text-zinc-500">шкала 0–100</span>
          </div>
          <div className="mt-4"><MetricsGauges scores={avg} large /></div>
        </section>
      ) : null}
      <section className="mt-4 border border-zinc-800 bg-zinc-900/70 p-5">
        <h2 className="font-display text-2xl text-white">Динаміка ваших проходжень</h2>
        <div className="mt-4"><Legend /></div>
        <div className="mt-4"><TrendChart rows={trend} /></div>
      </section>
      <section className="mt-4 border border-zinc-800 bg-zinc-900/70 p-5">
        <h2 className="font-display text-2xl text-white">Результати проходжень</h2>
        <div className="mt-4 flex flex-col gap-3">
          {completed.map((item) => {
            const passed = ["integrity", "trust", "effectiveness"].every((key) => (item.scores?.[key] ?? 0) >= 30);
            return (
              <button key={item.id} type="button" onClick={() => onOpen(item)} className="border border-zinc-800 bg-zinc-950 p-4 text-left hover:border-olive-500">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-zinc-100">{item.scenarioTitle}</p>
                  <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${passed ? "border-olive-600 text-olive-300" : "border-amber-700 text-amber-300"}`}>{passed ? "Пройшов тест" : "Не пройшов тест"}</span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-zinc-500">{new Date(item.createdAt).toLocaleString("uk-UA")} · {item.history?.length || 0} рішень</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-olive-300">
                  {METRICS.map((metric) => <span key={metric.key}>{metric.label}: {item.scores?.[metric.key] ?? 0}</span>)}
                </div>
              </button>
            );
          })}
          {!completed.length ? <p className="text-sm text-zinc-400">Результати з’являться після першого завершеного проходження.</p> : null}
        </div>
      </section>
      <button type="button" onClick={onStart} className="mt-5 border border-olive-600 bg-olive-800 px-5 py-3 font-display text-xl text-white">Продовжити тренування →</button>
    </section>
  );
}
