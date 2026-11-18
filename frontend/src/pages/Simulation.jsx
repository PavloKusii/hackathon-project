import { useEffect, useRef, useState } from "react";
import MetricsGauges from "../components/MetricsGauges";
import ActionCard from "../components/ActionCard";
import FeedbackPanel from "../components/FeedbackPanel";
import TimerReadout from "../components/TimerReadout";
import { findNode } from "../scenarioTree";
import { clampScore } from "../scores";

export default function Simulation({ scenario, run, setRun, onExit, onDebrief }) {
  const step = scenario.tree ? findNode(scenario.tree, run.nodeId) || scenario.tree : scenario.steps[run.stepIndex];
  const picked = step?.options?.find((item) => item.id === run.lockedId) || null;
  const last = scenario.tree ? !picked?.next : run.stepIndex >= scenario.steps.length - 1;
  const depth = scenario.tree ? (scenario.depth || "гілки") : scenario.steps.length;
  const caseLimit = Number(scenario.timeLimitSeconds) || 0;
  const stepLimit = Number(step?.timeLimitSeconds) || 0;
  const caseStartRef = useRef(Date.now());
  const endedRef = useRef(false);
  const [stepStart, setStepStart] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setStepStart(Date.now());
  }, [step?.id]);

  useEffect(() => {
    if (!caseLimit && !stepLimit) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [caseLimit, stepLimit, step?.id]);

  const caseEndsAt = caseLimit ? caseStartRef.current + caseLimit * 1000 : 0;
  const stepEndsAt = stepLimit ? stepStart + stepLimit * 1000 : 0;
  let endsAt = 0;
  let timerScope = "";
  if (caseEndsAt && (!stepEndsAt || caseEndsAt <= stepEndsAt)) {
    endsAt = caseEndsAt;
    timerScope = "case";
  } else if (stepEndsAt) {
    endsAt = stepEndsAt;
    timerScope = "step";
  }

  useEffect(() => {
    if (!endsAt || endedRef.current || endsAt > now) return;
    endedRef.current = true;
    setRun((current) => ({ ...current, timedOut: true }));
    onDebrief();
  }, [endsAt, now, onDebrief, setRun]);

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
      scores[key] = clampScore((scores[key] || 0) + Number(option.deltas?.[key] || 0));
    });
    const best = Math.max(...step.options.map((item) => Number(item.deltas?.integrity || 0)));
    setRun({
      ...run,
      revealed: true,
      lockedId: optionId,
      scores,
      history: [...run.history, {
        stepId: step.id,
        prompt: step.prompt,
        option,
        scores: { ...scores },
        mistake: Number(option.deltas?.integrity || 0) < best
      }]
    });
  }

  function next() {
    if (!run.revealed) return;
    if (scenario.tree) {
      if (!picked?.next) {
        onDebrief();
        return;
      }
      setRun({ ...run, nodeId: picked.next.id, revealed: false, lockedId: "" });
      window.scrollTo(0, 0);
      return;
    }
    if (last) {
      onDebrief();
      return;
    }
    setRun({ ...run, stepIndex: run.stepIndex + 1, revealed: false, lockedId: "" });
    window.scrollTo(0, 0);
  }

  if (!step) return null;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300 hover:border-olive-500">На головну</button>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          {scenario.code} · {scenario.tree ? `гілка ${step?.label || run.history.length + 1}` : `крок ${String(run.stepIndex + 1).padStart(2, "0")} / ${String(depth).padStart(2, "0")}`}
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
          <article className="mt-5 border border-zinc-800 bg-zinc-950/80 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{endsAt ? "Ситуація" : "Ситуація · без обмеження часу"}</p>
            <p className="mt-3 text-base leading-7 text-zinc-200">{step.prompt}</p>
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
          {endsAt ? <div className="mt-4"><TimerReadout endsAt={endsAt} scope={timerScope} /></div> : null}
          <p className="mt-4 text-xs leading-5 text-zinc-500">{endsAt ? "Коли відлік доходить до нуля, проходження закривається і відкривається розбір." : "Кожна шкала від 0 до 100 і стартує зі 100. Час на крок не обмежений."}</p>
        </aside>
      </div>
    </section>
  );
}
