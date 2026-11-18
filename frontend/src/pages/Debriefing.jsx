import MetricsGauges from "../components/MetricsGauges";
import { METRICS } from "../components/MetricsGauges";

function signed(value) {
  const number = Number(value) || 0;
  return number > 0 ? `+${number}` : String(number);
}

function tone(value) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-amber-400";
  return "text-zinc-500";
}

function posture(scores) {
  const lines = [];
  if (scores.integrity >= 74) lines.push("Доброчесність утримана високо: записи і слова лишилися близькими до фактів.");
  else if (scores.integrity >= 50) lines.push("Доброчесність у робочому діапазоні. Окремі кроки залишили відстань між документом і тим, що було видно.");
  else lines.push("Доброчесність просіла. Кілька рішень надали перевагу короткому спокою перед точним записом.");
  if (scores.trust >= 74) lines.push("Довіра посилюється там, де підрозділ і цивільні чують ту саму версію, що стоїть у документі.");
  else if (scores.trust >= 50) lines.push("Репутація лишається робочою. Окремі відповіді без сліду зробили її тоншою.");
  else lines.push("Довіра знизилась. Наступній доповіді буде важче, бо попередні вже розійшлися з фактом.");
  if (scores.effectiveness >= 74) lines.push("Ефективність висока. Поруч варто тримати питання, якою ціною втримано темп.");
  else if (scores.effectiveness >= 50) lines.push("Ефективність збережена в прийнятних межах для навчального проходження.");
  else lines.push("Темп просів. У цьому проході це наслідок прозорості.");
  return lines;
}

export default function Debriefing({ scenario, run, onAgain, onHome, stored, guest }) {
  const links = [];
  const seen = new Set();
  (scenario.norms || []).forEach((norm) => {
    if (!norm?.title || seen.has(norm.title)) return;
    seen.add(norm.title);
    links.push(norm);
  });
  run.history.forEach((entry) => {
    (entry.option.legalRefs || []).forEach((norm) => {
      if (!norm?.title || seen.has(norm.title)) return;
      seen.add(norm.title);
      links.push(norm);
    });
  });

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">{scenario.code} · підсумок</p>
      <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">Розбір проходження</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{scenario.title}. Нижче ваші відповіді, пояснення і те, де вибір був слабшим за доброчесністю відносно інших варіантів цього кроку.</p>
      {run.timedOut ? <p className="mt-3 border border-amber-700 bg-amber-950 px-4 py-3 text-sm text-amber-100">Час вийшов. Проходження закрито автоматично. Нижче розбір відповідей, які встигли надійти, разом із поясненнями і слабшими рішеннями.</p> : null}
      {run.history.length === 0 ? <p className="mt-3 text-sm leading-6 text-zinc-400">Відповідей ще не було, тож шкали лишилися на старті.</p> : null}
      {guest ? <p className="mt-3 border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">Ви пройшли кейс як гість. Ці відповіді ніде не зберігаються.</p> : null}
      {stored ? <p className="mt-3 border border-olive-900 bg-olive-950 px-4 py-3 text-sm text-olive-100">Розбір збережено на вашому обліковому записі.</p> : null}
      <section className="mt-6 border border-zinc-800 bg-zinc-900/80 p-5">
        <MetricsGauges scores={run.scores} large />
      </section>
      <section className="mt-4 border border-zinc-800 bg-zinc-950/70 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive-400">Читання шкал</p>
        <div className="mt-3 flex flex-col gap-2">
          {posture(run.scores).map((line) => (
            <p key={line} className="text-sm leading-6 text-zinc-300">{line}</p>
          ))}
        </div>
      </section>
      <section className="mt-4">
        <h2 className="font-display text-3xl tracking-wide text-zinc-50">Правове обґрунтування</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {links.map((norm) => (
            <li key={norm.title}>
              {norm.href ? (
                <a className="text-sm text-amber-500/90 underline decoration-zinc-700 underline-offset-4 hover:text-amber-400" href={norm.href} target="_blank" rel="noopener noreferrer">{norm.title}</a>
              ) : (
                <span className="text-sm text-zinc-300">{norm.title}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-4 flex flex-col gap-3">
        {run.history.map((entry, index) => (
          <article key={`${entry.stepId}-${index}`} className="border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Крок {String(index + 1).padStart(2, "0")}</p>
            <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.16em] ${entry.mistake ? "text-amber-400" : "text-olive-400"}`}>{entry.mistake ? "Слабше рішення за доброчесністю" : "Рішення тримає доброчесність на рівні найсильнішого варіанта"}</p>
            {entry.prompt ? <p className="mt-2 text-sm leading-6 text-zinc-500">{entry.prompt}</p> : null}
            <h2 className="mt-2 font-display text-2xl tracking-wide text-zinc-50">{entry.option.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{entry.option.analysis}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{entry.option.legal}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {METRICS.map((metric) => {
                const value = Number(entry.option.deltas?.[metric.key] || 0);
                return (
                  <span key={metric.key} className={`font-mono text-xs ${tone(value)}`}>
                    {metric.short} {signed(value)}
                  </span>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={onAgain} className="border border-olive-600 bg-olive-800 px-5 py-3 font-display text-xl tracking-[0.1em] text-olive-100 hover:border-olive-500 hover:bg-olive-700">Пройти ще раз</button>
        <button type="button" onClick={onHome} className="border border-zinc-700 px-5 py-3 font-display text-xl tracking-[0.1em] text-zinc-200 hover:border-olive-500">На головну</button>
      </div>
    </section>
  );
}
