import { useMemo, useState } from "react";
import { Legend, ShareChart, TrendChart } from "../components/Charts";
import MetricsGauges, { METRICS } from "../components/MetricsGauges";

const TABS = [
  ["overview", "Загальна статистика"],
  ["dynamics", "Динаміка проходження"],
  ["analytics", "Аналітика занять"]
];

function groupTrend(session) {
  let scores = { integrity: 100, trust: 100, effectiveness: 100 };
  return (session?.steps || []).map((step, index) => {
    const total = (step.options || []).reduce((sum, option) => sum + (option.count || 0), 0);
    if (total) {
      ["integrity", "trust", "effectiveness"].forEach((key) => {
        const delta = step.options.reduce((sum, option) => sum + (option.count || 0) * Number(option.deltas?.[key] || 0), 0) / total;
        scores = { ...scores, [key]: Math.max(0, Math.min(100, Math.round(scores[key] + delta))) };
      });
    }
    return { label: String(index + 1).padStart(2, "0"), ...scores };
  });
}

export default function OrganizerStats({ sessions, scenarios, attempts = [], initialTab = "overview", onBack }) {
  const [tab, setTab] = useState(initialTab);
  const [mode, setMode] = useState("own");
  const [sessionId, setSessionId] = useState(sessions[0]?.id || "");
  const selected = sessions.find((item) => item.id === sessionId) || sessions[0] || null;
  const totals = useMemo(() => ({
    sessions: sessions.length,
    people: sessions.reduce((sum, item) => sum + (item.participantPeak || 0), 0),
    answers: sessions.reduce((sum, item) => sum + (item.steps || []).reduce((inner, step) => inner + (step.options || []).reduce((count, option) => count + (option.count || 0), 0), 0), 0)
  }), [sessions]);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[.2em] text-olive-400">Панель організатора</p>
          <h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">Статистика</h1>
        </div>
        <button type="button" onClick={onBack} className="border border-zinc-700 px-4 py-3 text-sm text-zinc-300">На головну</button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode("own")} className={`border px-4 py-2 font-mono text-xs uppercase tracking-widest ${mode === "own" ? "border-olive-500 bg-olive-950 text-olive-200" : "border-zinc-800 text-zinc-400"}`}>Моя статистика</button>
        <button type="button" onClick={() => setMode("groups")} className={`border px-4 py-2 font-mono text-xs uppercase tracking-widest ${mode === "groups" ? "border-olive-500 bg-olive-950 text-olive-200" : "border-zinc-800 text-zinc-400"}`}>Статистика занять</button>
      </div>
      {mode === "own" ? (
        <>
          <section className="mt-5 border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="font-display text-2xl text-white">Мої проходження</h2>
            {attempts.length ? (
              <div className="mt-4 flex flex-col gap-3">
                {attempts.map((item) => {
                  const passed = ["integrity", "trust", "effectiveness"].every((key) => (item.scores?.[key] ?? 0) >= 30);
                  return (
                    <article key={item.id} className="border border-zinc-800 bg-zinc-950 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-zinc-100">{item.scenarioTitle}</p>
                        <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${passed ? "border-olive-600 text-olive-300" : "border-amber-700 text-amber-300"}`}>{passed ? "Пройшов тест" : "Не пройшов тест"}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <p className="mt-3 text-sm text-zinc-400">Власних проходжень ще немає.</p>}
          </section>
          <section className="mt-4 border border-zinc-800 bg-zinc-900/70 p-5">
            <MetricsGauges scores={attempts.length ? attempts.reduce((out, item) => {
              METRICS.forEach((metric) => { out[metric.key] = Math.round(out[metric.key] + (item.scores?.[metric.key] || 0)); });
              return out;
            }, { integrity: 0, trust: 0, effectiveness: 0 }) : { integrity: 0, trust: 0, effectiveness: 0 }} large />
          </section>
        </>
      ) : null}
      {mode === "groups" ? (
        <>
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`border px-4 py-2 font-mono text-xs uppercase tracking-widest ${tab === id ? "border-olive-500 bg-olive-950 text-olive-200" : "border-zinc-800 text-zinc-400"}`}>{label}</button>
        ))}
      </div>
      {tab === "overview" ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[["Занять", totals.sessions], ["Пік учасників", totals.people], ["Відповідей", totals.answers], ["Сценаріїв", scenarios.length]].map(([label, value]) => (
              <article key={label} className="border border-zinc-800 bg-zinc-900/80 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
                <p className="mt-2 font-display text-4xl text-white">{value}</p>
              </article>
            ))}
          </div>
          <article className="mt-4 border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="font-display text-2xl text-white">Групи</h2>
            {sessions.length === 0 ? <p className="mt-3 text-sm text-zinc-400">Завершіть групове заняття, і зведення з’явиться тут під назвою групи або за датою.</p> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {sessions.slice(0, 6).map((room) => (
                <div key={room.id} className="border border-zinc-800 bg-zinc-950 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-olive-400">{room.groupLabel}</p>
                  <h3 className="mt-2 font-display text-xl text-white">{room.scenarioTitle}</h3>
                  <p className="mt-2 text-xs text-zinc-500">Пік {room.participantPeak || 0} · {new Date(room.finishedAt || room.createdAt).toLocaleString("uk-UA")}</p>
                </div>
              ))}
            </div>
          </article>
        </>
      ) : null}
      {tab === "dynamics" ? (
        <article className="mt-5 border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-white">Динаміка проходження</h2>
              <p className="mt-1 text-sm text-zinc-400">Динаміка змін показників у вибраному занятті.</p>
            </div>
            <select value={selected?.id || ""} onChange={(event) => setSessionId(event.target.value)} className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
              {sessions.map((item) => <option key={item.id} value={item.id}>{item.groupLabel} · {item.scenarioTitle}</option>)}
            </select>
          </div>
          <div className="mt-4"><Legend /></div>
          <div className="mt-4"><TrendChart rows={groupTrend(selected)} /></div>
        </article>
      ) : null}
      {tab === "analytics" ? (
        <article className="mt-5 border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-white">Аналітика занять</h2>
              <p className="mt-1 text-sm text-zinc-400">Розподіл відповідей у вибраному занятті.</p>
            </div>
            <select value={selected?.id || ""} onChange={(event) => setSessionId(event.target.value)} className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
              {sessions.map((item) => <option key={item.id} value={item.id}>{item.groupLabel} · {item.scenarioCode}</option>)}
            </select>
          </div>
          <div className="mt-4"><ShareChart steps={selected?.steps || []} /></div>
        </article>
      ) : null}
        </>
      ) : null}
    </section>
  );
}
