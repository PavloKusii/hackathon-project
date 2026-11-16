import { useEffect, useState } from "react";
import MetricsGauges from "../components/MetricsGauges";
import ActionCard from "../components/ActionCard";
import FeedbackPanel from "../components/FeedbackPanel";

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatClock(total) {
  const seconds = Math.max(0, total);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export default function Simulation({ scenario, run, setRun, onExit, onDebrief }) {
  const step = scenario.steps[run.stepIndex];
  const limit = Number(scenario.pressureSeconds) || 90;
  const [left, setLeft] = useState(limit);
  const picked = step?.options?.find((item) => item.id === run.lockedId) || null;
  const last = run.stepIndex >= scenario.steps.length - 1;

  useEffect(() => {
    setLeft(limit);
    const started = Date.now();
    const timer = setInterval(() => {
      const passed = Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, limit - passed));
    }, 250);
    return () => clearInterval(timer);
  }, [scenario.id, run.stepIndex, limit]);

  useEffect(() => {
    if (!run.revealed) return;
    document.getElementById("feedback")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [run.revealed, run.stepIndex]);

  function choose(optionId) {
    if (run.revealed || !step) return;
    const option = step.options.find((item) => item.id === optionId);
    if (!option) return;
    const scores = { ...run.scores };
    ["integrity", "trust", "effectiveness"].forEach((key) => {
      scores[key] = clamp((scores[key] || 0) + Number(option.deltas?.[key] || 0));
    });
    setRun({
      ...run,
      revealed: true,
      lockedId: optionId,
      scores,
      history: [...run.history, { stepId: step.id, prompt: step.prompt, option, scores: { ...scores } }]
    });
  }

  function next() {
    if (!run.revealed) return;
    if (last) {
      onDebrief();
      return;
    }
    setRun({ ...run, stepIndex: run.stepIndex + 1, revealed: false, lockedId: "" });
    window.scrollTo(0, 0);
  }

  if (!step) return null;

  const urgent = left <= 15;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300 hover:border-olive-500">На головну</button>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          {scenario.code} · крок {String(run.stepIndex + 1).padStart(2, "0")} / {String(scenario.steps.length).padStart(2, "0")}
        </p>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="order-2 lg:order-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-olive-400">{scenario.field}</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">{scenario.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {(scenario.norms || []).map((norm) => (
              <span key={norm.title} className="border border-zinc-800 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">{norm.title}</span>
            ))}
          </div>
          <article className={`mt-5 border bg-zinc-950/80 p-5 ${urgent ? "border-amber-700" : "border-zinc-800"}`}>
            <div className="flex items-start justify-between gap-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Ситуація</p>
              <div className="text-right">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Вікно рішення</p>
                <p className={`font-mono text-2xl ${urgent ? "text-amber-400" : "text-zinc-100"}`}>{formatClock(left)}</p>
              </div>
            </div>
            <p className="mt-3 text-base leading-7 text-zinc-200">{step.prompt}</p>
            {left === 0 ? <p className="mt-3 text-sm text-amber-400">Час вікна вичерпано. Рішення ще можна зафіксувати.</p> : null}
          </article>
          <div className="mt-4 flex flex-col gap-3">
            {step.options.map((option, index) => (
              <ActionCard
                key={option.id}
                index={index}
                option={option}
                selected={run.revealed && run.lockedId === option.id}
                collapsed={run.revealed && run.lockedId !== option.id}
                onSelect={choose}
              />
            ))}
          </div>
          {run.revealed && picked ? <FeedbackPanel option={picked} last={last} onNext={next} /> : null}
        </div>
        <aside className="order-1 border border-zinc-800 bg-zinc-900/80 p-4 lg:order-2 lg:sticky lg:top-4 lg:self-start">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Шкали в реальному часі</p>
          <div className="mt-4">
            <MetricsGauges scores={run.scores} />
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">Кожне значення від 0 до 100. Вибір фіксує картку і одразу змінює баланс.</p>
        </aside>
      </div>
    </section>
  );
}
