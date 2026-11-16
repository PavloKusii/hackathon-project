export const METRICS = [
  { key: "integrity", label: "Доброчесність", short: "ДОБР", color: "#c2b280" },
  { key: "trust", label: "Довіра та репутація", short: "ДОВІРА", color: "#8ea05a" },
  { key: "effectiveness", label: "Ефективність", short: "ЕФЕКТ", color: "#d6a045" }
];

function Ring({ metric, value, large }) {
  const size = large ? 132 : 84;
  const stroke = large ? 8 : 6;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const safe = Math.max(0, Math.min(100, Math.round(value || 0)));
  const offset = circ * (1 - safe / 100);
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#3f3f46" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={metric.color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="#f4f4f5"
          fontFamily="IBM Plex Mono, monospace"
          fontSize={large ? 28 : 16}
        >
          {safe}
        </text>
      </svg>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{metric.short}</p>
        <p className="text-sm text-zinc-100">{metric.label}</p>
      </div>
    </div>
  );
}

export default function MetricsGauges({ scores, large = false }) {
  return (
    <div className={large ? "grid gap-5 sm:grid-cols-3" : "flex flex-col gap-4"}>
      {METRICS.map((metric) => (
        <Ring key={metric.key} metric={metric} value={scores?.[metric.key]} large={large} />
      ))}
    </div>
  );
}
