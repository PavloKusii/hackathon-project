import { useEffect, useMemo, useState } from "react";
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

export default function OrganizerStats({ sessions, scenarios, attempts = [], initialTab = "overview", onBack, onOpenAttempt }) {
  const [tab, setTab] = useState(initialTab);
  const [mode, setMode] = useState("own");
  const [sessionId, setSessionId] = useState(sessions[0]?.id || "");
  const [participantModal, setParticipantModal] = useState(null);

  useEffect(() => {
    if (!sessions.length) {
      setSessionId("");
      return;
    }
    if (!sessions.some((item) => item.id === sessionId)) {
      setSessionId(sessions[0].id);
    }
  }, [sessions, sessionId]);

  const selected = sessions.find((item) => item.id === sessionId) || sessions[0] || null;
  const totals = useMemo(() => ({
    sessions: sessions.length,
    people: sessions.reduce((sum, item) => sum + Math.max(item.participantPeak || 0, (item.participants || []).length), 0),
    answers: sessions.reduce((sum, item) => sum + (item.steps || []).reduce((inner, step) => inner + (step.options || []).reduce((count, option) => count + (option.count || 0), 0), 0), 0)
  }), [sessions]);
  const personalStats = useMemo(() => ({
    integrity: attempts.length ? Math.round(attempts.reduce((sum, item) => sum + (item.scores?.integrity || 0), 0) / attempts.length) : 0,
    trust: attempts.length ? Math.round(attempts.reduce((sum, item) => sum + (item.scores?.trust || 0), 0) / attempts.length) : 0,
    effectiveness: attempts.length ? Math.round(attempts.reduce((sum, item) => sum + (item.scores?.effectiveness || 0), 0) / attempts.length) : 0
  }), [attempts]);
  const sessionInsights = useMemo(() => {
    if (!selected) return null;
    const participants = selected.participants || [];
    const finishedCount = participants.filter((participant) =>
        participant.status === "completed" || participant.status === "Завершено" || Boolean(participant.completedAt)
    ).length;
    const riskSteps = (selected.steps || []).map((step) => {
      const risky = (step.options || []).filter((option) =>
          ["integrity", "trust", "effectiveness"].some((metric) => Number(option.deltas?.[metric] || 0) < 0)
      );
      const riskyCount = risky.reduce((sum, option) => sum + (option.count || 0), 0);
      const total = (step.options || []).reduce((sum, option) => sum + (option.count || 0), 0);
      return { step, riskyCount, total };
    }).filter((item) => item.total > 0).sort((a, b) => (b.riskyCount / b.total) - (a.riskyCount / a.total));
    const strongSteps = (selected.steps || []).map((step) => {
      const safeCount = (step.options || []).reduce((sum, option) => {
        const safe = ["integrity", "trust", "effectiveness"].every((metric) => Number(option.deltas?.[metric] || 0) === 0);
        return sum + (safe ? (option.count || 0) : 0);
      }, 0);
      const total = (step.options || []).reduce((sum, option) => sum + (option.count || 0), 0);
      return { step, safeCount, total };
    }).filter((item) => item.total > 0).sort((a, b) => (b.safeCount / b.total) - (a.safeCount / a.total));
    const riskLoss = (selected.steps || []).reduce((sum, step) =>
        sum + (step.options || []).reduce((inner, option) =>
            inner + (option.count || 0) * ["integrity", "trust", "effectiveness"].reduce((loss, metric) =>
                loss + Math.min(0, Number(option.deltas?.[metric] || 0)), 0), 0), 0);
    const averageRiskLoss = participants.length ? Math.round(riskLoss / participants.length) : 0;
    const metricAverage = (participant) => {
      const scores = participant?.scores || {};
      const values = [
        Number(scores.integrity || 0),
        Number(scores.trust || 0),
        Number((scores.reputation ?? scores.trust) || 0),
        Number(scores.effectiveness || 0)
      ];
      return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    };
    const averageScore = participants.length
        ? Math.round(participants.reduce((sum, participant) => sum + metricAverage(participant), 0) / participants.length)
        : 0;
    const ranked = [...participants].sort((a, b) => metricAverage(b) - metricAverage(a));
    const worstStep = riskSteps[0]?.step || null;
    return { participants, finishedCount, riskSteps, strongSteps, riskLoss, averageRiskLoss, averageScore, best: ranked[0] || null, worst: ranked[ranked.length - 1] || null, worstStep };
  }, [selected]);

  const modalEntries = participantModal ? (participantModal.answers || participantModal.history || []) : [];

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
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["Проходжень", attempts.length],
                  ["Зроблено виборів", attempts.reduce((sum, item) => sum + (item.history?.length || 0), 0)],
                  ["Остання активність", attempts[0] ? new Date(attempts[0].createdAt).toLocaleDateString("uk-UA") : "—"]
                ].map(([label, value]) => (
                    <article key={label} className="border border-zinc-800 bg-zinc-900/80 p-5">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
                      <p className="mt-2 font-display text-4xl text-white">{value}</p>
                    </article>
                ))}
              </div>
              <section className="mt-4 border border-zinc-800 bg-zinc-900/70 p-5">
                <h2 className="font-display text-2xl text-white">Середні показники проходжень</h2>
                <div className="mt-4"><MetricsGauges scores={personalStats} large /></div>
              </section>
              <section className="mt-4 border border-zinc-800 bg-zinc-900/70 p-5">
                <h2 className="font-display text-2xl text-white">Результати проходжень</h2>
                <div className="mt-4 flex flex-col gap-3">
                  {attempts.map((item) => {
                    const passed = METRICS.every((metric) => (item.scores?.[metric.key] ?? 0) >= 30);
                    return (
                        <button key={item.id} type="button" onClick={() => onOpenAttempt?.(item)} className="border border-zinc-800 bg-zinc-950 p-4 text-left hover:border-olive-500">
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
                  {!attempts.length ? <p className="text-sm text-zinc-400">Результати з’являться після першого завершеного проходження.</p> : null}
                </div>
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
                              <p className="mt-2 text-xs text-zinc-500">Учасників: {Math.max(room.participantPeak || 0, (room.participants || []).length)} · {new Date(room.finishedAt || room.createdAt).toLocaleString("uk-UA")}</p>
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
                    {sessionInsights ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Учасники</p>
                            <p className="mt-2 font-display text-3xl text-white">{sessionInsights.participants.length}</p>
                            <p className="mt-1 text-xs text-zinc-400">Завершили: {sessionInsights.finishedCount}</p>
                          </article>
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Доброчесність</p>
                            <p className="mt-2 font-display text-3xl text-white">{sessionInsights.participants.length ? Math.round(sessionInsights.participants.reduce((sum, participant) => sum + (participant.scores?.integrity ?? 0), 0) / sessionInsights.participants.length) : 0}</p>
                          </article>
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Довіра та репутація</p>
                            {sessionInsights.participants.length ? (
                                <>
                                  <p className="mt-2 text-sm text-zinc-200">Довіра: <span className="font-display text-xl text-white">{Math.round(sessionInsights.participants.reduce((sum, participant) => sum + (participant.scores?.trust ?? 0), 0) / sessionInsights.participants.length)}</span></p>
                                  <p className="mt-1 text-sm text-zinc-200">Репутація: <span className="font-display text-xl text-white">{Math.round(sessionInsights.participants.reduce((sum, participant) => sum + (participant.scores?.reputation ?? participant.scores?.trust ?? 0), 0) / sessionInsights.participants.length)}</span></p>
                                </>
                            ) : <p className="mt-2 font-display text-3xl text-white">0 / 0</p>}
                          </article>
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Ефективність</p>
                            <p className="mt-2 font-display text-3xl text-white">{sessionInsights.participants.length ? Math.round(sessionInsights.participants.reduce((sum, participant) => sum + (participant.scores?.effectiveness ?? 0), 0) / sessionInsights.participants.length) : 0}</p>
                          </article>
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Краще / гірше</p>
                            <p className="mt-2 text-sm text-olive-300">{sessionInsights.best?.name || "—"}: {sessionInsights.best?.averageScore ?? "—"}</p>
                            <p className="mt-1 text-sm text-amber-300">{sessionInsights.worst?.name || "—"}: {sessionInsights.worst?.averageScore ?? "—"}</p>
                          </article>
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Найпроблемніше питання</p>
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-300">{sessionInsights.worstStep?.prompt || "Достатньо даних ще немає"}</p>
                          </article>
                        </div>
                    ) : null}
                    {sessionInsights ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-olive-400">Група</p>
                            <p className="mt-2 text-sm leading-6 text-zinc-200">Пройшли: {sessionInsights.participants.length}. Середня сума втрат балів: {sessionInsights.averageRiskLoss}. Найчастіші гілки визначаються маршрутами учасників.</p>
                          </article>
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Проблемні точки</p>
                            {sessionInsights.riskSteps.slice(0, 3).map(({ step, riskyCount, total }) => (
                                <p key={step.stepId} className="mt-2 text-sm leading-6 text-zinc-300">{step.prompt} — ризикові вибори: {riskyCount}/{total}</p>
                            ))}
                          </article>
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-olive-400">Сильні рішення</p>
                            {sessionInsights.strongSteps.slice(0, 3).map(({ step, safeCount, total }) => (
                                <p key={step.stepId} className="mt-2 text-sm leading-6 text-zinc-300">{step.prompt} — без втрат: {safeCount}/{total}</p>
                            ))}
                          </article>
                        </div>
                    ) : null}
                    {sessionInsights?.participants?.length ? (
                        <div className="mt-4 flex flex-col gap-3">
                          {sessionInsights.participants.map((participant) => (
                              <article key={participant.id} className="border border-zinc-800 bg-zinc-950">
                                <button type="button" onClick={() => setParticipantModal(participant)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:border-olive-500">
                                  <div>
                                    <p className="font-display text-xl text-zinc-100">{participant.name}</p>
                                    <p className="mt-1 text-sm text-zinc-300">
                                      Доброчесність {participant.scores?.integrity ?? 0} · Довіра та репутація {participant.scores?.trust ?? 0} / {participant.scores?.reputation ?? participant.scores?.trust ?? 0} · Ефективність {participant.scores?.effectiveness ?? 0}
                                    </p>
                                    <p className="mt-1 text-xs text-zinc-400">Статус: {participant.statusLabel || participant.status || "У процесі"}</p>
                                  </div>
                                  <span className="font-mono text-[10px] uppercase tracking-widest text-olive-400">Деталі</span>
                                </button>
                              </article>
                          ))}
                        </div>
                    ) : null}
                    {sessionInsights ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Що опрацювати</p>
                            {sessionInsights.riskSteps.slice(0, 3).map(({ step }) => (
                                <p key={step.stepId} className="mt-2 text-sm leading-6 text-zinc-300">Обговорити рішення на етапі: {step.prompt}</p>
                            ))}
                            {!sessionInsights.riskSteps.length ? <p className="mt-2 text-sm text-zinc-400">Ризикових зон за поточними даними не виявлено.</p> : null}
                          </article>
                          <article className="border border-zinc-800 bg-zinc-950 p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-olive-400">Що група пройшла впевнено</p>
                            {sessionInsights.strongSteps.slice(0, 3).map(({ step }) => (
                                <p key={step.stepId} className="mt-2 text-sm leading-6 text-zinc-300">{step.prompt}</p>
                            ))}
                            {!sessionInsights.strongSteps.length ? <p className="mt-2 text-sm text-zinc-400">Сильних зон без втрат балів за поточними даними не виявлено.</p> : null}
                          </article>
                        </div>
                    ) : null}
                    <div className="mt-4"><ShareChart steps={selected?.steps || []} /></div>
                  </article>
              ) : null}
            </>
        ) : null}
        {participantModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={`Розбір учасника ${participantModal.name}`}>
              <article className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-zinc-700 bg-zinc-950 p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-olive-400">Розбір учасника</p>
                    <h2 className="mt-2 font-display text-3xl text-white">{participantModal.name}</h2>
                  </div>
                  <button type="button" onClick={() => setParticipantModal(null)} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300">Закрити</button>
                </div>
                <p className="mt-4 text-sm text-zinc-300">
                  Статус: {participantModal.statusLabel || participantModal.status || "У процесі"} ·
                  Доброчесність {participantModal.scores?.integrity ?? 0} ·
                  Довіра та репутація {participantModal.scores?.trust ?? 0} / {participantModal.scores?.reputation ?? participantModal.scores?.trust ?? 0} ·
                  Ефективність {participantModal.scores?.effectiveness ?? 0}
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  Рівень ризику: {(() => {
                  const scores = participantModal.scores || {};
                  const values = [
                    Number(scores.integrity || 0),
                    Number(scores.trust || 0),
                    Number((scores.reputation ?? scores.trust) || 0),
                    Number(scores.effectiveness || 0)
                  ];
                  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
                  return average < 60 ? "Високий" : average < 85 ? "Середній" : "Низький";
                })()} · {participantModal.verdict}
                </p>
                <p className="mt-2 text-sm text-zinc-300">Гілка: {participantModal.branch || participantModal.branchLabel || "Лінійний маршрут"}</p>
                <div className="mt-4 flex flex-col gap-3">
                  {modalEntries.map((entry, index) => (
                      <div key={`${entry.stepId}-${index}`} className="border border-zinc-800 bg-zinc-900 p-4">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Крок {index + 1}{entry.label ? ` · гілка ${entry.label}` : ""}</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-200">{entry.prompt}</p>
                        <p className="mt-2 text-sm text-olive-300">{entry.optionTitle}</p>
                        <p className="mt-1 text-xs text-zinc-400">Бали: Доброчесність {entry.deltas?.integrity || 0} · Довіра та репутація {entry.deltas?.trust || 0} / {(entry.deltas?.reputation ?? entry.deltas?.trust) || 0} · Ефективність {entry.deltas?.effectiveness || 0}</p>
                      </div>
                  ))}
                  {!modalEntries.length ? <p className="text-sm text-zinc-400">На момент завершення відповіді ще не були збережені.</p> : null}
                </div>
              </article>
            </div>
        ) : null}
      </section>
  );
}