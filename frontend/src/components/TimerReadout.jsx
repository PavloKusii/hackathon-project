import { useEffect, useState } from "react";
import { formatClock } from "../timer";

export default function TimerReadout({ endsAt, scope }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!endsAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return null;
  const left = Math.max(0, endsAt - now);
  const urgent = left <= 30000;
  const label = scope === "step" ? "Час на це завдання" : "Час на весь тест";

  return (
    <div className={`border px-4 py-3 ${urgent ? "border-amber-500 bg-amber-950 text-amber-100" : "border-olive-700 bg-olive-950 text-olive-100"}`} role="timer">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-1 font-display text-5xl tracking-wide tabular-nums">{formatClock(left)}</p>
    </div>
  );
}
