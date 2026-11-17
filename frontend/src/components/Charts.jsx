import { METRICS } from "./MetricsGauges";

export function ShareChart({ steps }) {
  if (!steps?.length) return <p className="text-sm text-zinc-400">Зведена діаграма з’явиться після першого кроку.</p>;
  return (
    <div className="flex flex-col gap-4">
      {steps.map((step) => (
        <article key={`${step.stepId}-${step.stepIndex}`} className="border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-400">Крок {String(step.stepIndex + 1).padStart(2, "0")}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-300">{step.prompt}</p>
          <div className="mt-3 flex h-3 overflow-hidden bg-zinc-800">
            {(step.options || []).map((option, index) => (
              <div
                key={option.id}
                className="h-full"
                style={{ width: `${option.pct || 0}%`, background: ["#8ea05a", "#d6a045", "#c2b280", "#7c8ea3"][index % 4] }}
                title={`${option.title}: ${option.pct || 0}%`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {(step.options || []).map((option, index) => (
              <div key={option.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-zinc-300">
                  <span className="h-2.5 w-2.5 shrink-0" style={{ background: ["#8ea05a", "#d6a045", "#c2b280", "#7c8ea3"][index % 4] }} />
                  <span className="truncate">{option.title}</span>
                </span>
                <span className="font-mono text-xs text-zinc-400">{option.pct || 0}% · {option.count || 0}</span>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export function TrendChart({ rows }) {
  const width = 640;
  const height = 220;
  const pad = 28;
  if (!rows?.length) return <p className="text-sm text-zinc-400">Динаміка з’явиться, коли будуть збережені проходження або кроки.</p>;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  const xAt = (index) => pad + (rows.length === 1 ? plotW / 2 : (index / (rows.length - 1)) * plotW);
  const yAt = (value) => pad + (1 - Math.max(0, Math.min(100, value)) / 100) * plotH;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Динаміка шкал">
      {[0, 50, 100].map((mark) => (
        <g key={mark}>
          <line x1={pad} x2={width - pad} y1={yAt(mark)} y2={yAt(mark)} stroke="#3f3f46" strokeDasharray="3 4" />
          <text x="4" y={yAt(mark) + 4} fill="#a1a1aa" fontSize="10" fontFamily="IBM Plex Mono, monospace">{mark}</text>
        </g>
      ))}
      {METRICS.map((metric) => {
        const d = rows.map((row, index) => `${index === 0 ? "M" : "L"} ${xAt(index)} ${yAt(Number(row[metric.key]) || 0)}`).join(" ");
        return <path key={metric.key} d={d} fill="none" stroke={metric.color} strokeWidth="2.5" />;
      })}
      {rows.map((row, index) => (
        <text key={row.label || index} x={xAt(index)} y={height - 6} textAnchor="middle" fill="#a1a1aa" fontSize="10" fontFamily="IBM Plex Mono, monospace">
          {row.label}
        </text>
      ))}
    </svg>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-4">
      {METRICS.map((metric) => (
        <span key={metric.key} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          <span className="h-2 w-4" style={{ background: metric.color }} />
          {metric.label}
        </span>
      ))}
    </div>
  );
}
