import { LETTERS } from "../scenarioTree";

const NODE_W = 188;
const NODE_H = 86;
const CHIP_W = 168;
const CHIP_H = 52;
const COL = 268;
const ROW = 124;
const PAD = 28;

function ready(node) {
  const prompt = (node.prompt || "").trim().length >= 10;
  const titles = (node.options || []).every((option) => (option.title || "").trim().length >= 2);
  return prompt && titles;
}

function place(node, depth, rowStart, nodes, edges, chips) {
  const items = (node.options || []).map((option, index) => ({ option, index }));
  if (!items.length) {
    nodes.push({ node, x: PAD + depth * COL, y: PAD + rowStart * ROW });
    return rowStart + 1;
  }
  let row = rowStart;
  const placed = [];
  items.forEach((item) => {
    const letter = LETTERS[item.index] || String(item.index + 1);
    if (item.option.next) {
      const start = row;
      row = place(item.option.next, depth + 1, row, nodes, edges, chips);
      placed.push({ letter, title: item.option.title, optionId: item.option.id, target: item.option.next.id, mid: (start + row - 1) / 2 });
      return;
    }
    const chipId = `${node.id}-${item.option.id}`;
    chips.push({
      id: chipId,
      parentId: node.id,
      optionId: item.option.id,
      letter,
      title: item.option.title,
      x: PAD + (depth + 1) * COL,
      y: PAD + row * ROW + (NODE_H - CHIP_H) / 2
    });
    placed.push({ letter, title: item.option.title, optionId: item.option.id, target: chipId, mid: row });
    row += 1;
  });
  const mid = (rowStart + row - 1) / 2;
  nodes.push({ node, x: PAD + depth * COL, y: PAD + mid * ROW });
  placed.forEach((item) => {
    edges.push({ from: node.id, to: item.target, optionId: item.optionId, letter: item.letter, title: item.title });
  });
  return row;
}

export default function ScenarioGraph({ tree, selectedId, selectedOptionId, onSelectNode, onSelectOption }) {
  const nodes = [];
  const edges = [];
  const chips = [];
  place(tree, 0, 0, nodes, edges, chips);
  const byId = new Map(nodes.map((item) => [item.node.id, item]));
  chips.forEach((chip) => byId.set(chip.id, { x: chip.x, y: chip.y, chip: true }));
  const points = [...nodes.map((item) => item.x + NODE_W), ...chips.map((chip) => chip.x + CHIP_W)];
  const bottoms = [...nodes.map((item) => item.y + NODE_H), ...chips.map((chip) => chip.y + CHIP_H)];
  const width = Math.max(...points) + PAD;
  const height = Math.max(...bottoms) + PAD;

  return (
    <div className="overflow-auto border border-zinc-800 bg-zinc-950/80" style={{ minHeight: 420 }}>
      <div className="relative" style={{ width, height: Math.max(height, 420) }}>
        <svg className="absolute inset-0" width={width} height={Math.max(height, 420)} aria-hidden="true">
          <defs>
            <marker id="scenario-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#8a9a3a" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.x + NODE_W;
            const y1 = from.y + (from.chip ? CHIP_H : NODE_H) / 2;
            const x2 = to.x;
            const y2 = to.y + (to.chip ? CHIP_H : NODE_H) / 2;
            const mid = x1 + (x2 - x1) * 0.55;
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2 - 2}`}
                fill="none"
                stroke="#3f4a22"
                strokeWidth="2"
                markerEnd="url(#scenario-arrow)"
              />
            );
          })}
        </svg>
        {edges.map((edge) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to || to.chip) return null;
          const x1 = from.x + NODE_W;
          const x2 = to.x;
          const mid = x1 + (x2 - x1) * 0.55;
          const y = from.y + (from.chip ? CHIP_H : NODE_H) / 2;
          return (
            <button
              key={`label-${edge.from}-${edge.to}`}
              type="button"
              onClick={() => onSelectOption(edge.from, edge.optionId)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${selectedId === edge.from && selectedOptionId === edge.optionId ? "border-olive-300 bg-olive-900 text-olive-100" : "border-olive-700 bg-zinc-950 text-olive-200"}`}
              style={{ left: mid, top: y }}
              title={edge.title ? `Варіант ${edge.letter}: ${edge.title}` : `Варіант ${edge.letter}`}
            >
              {edge.letter}
            </button>
          );
        })}
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelectOption(chip.parentId, chip.optionId)}
            className={`absolute overflow-hidden border px-3 py-2 text-left ${selectedId === chip.parentId && selectedOptionId === chip.optionId ? "border-olive-300 bg-olive-950" : "border-zinc-700 bg-zinc-900 hover:border-olive-600"}`}
            style={{ left: chip.x, top: chip.y, width: CHIP_W, height: CHIP_H }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-olive-300">Варіант {chip.letter}</span>
            <span className="mt-0.5 block truncate text-xs text-zinc-400">{(chip.title || "").trim() || "Ще без назви"}</span>
          </button>
        ))}
        {nodes.map(({ node, x, y }) => {
          const active = node.id === selectedId && !selectedOptionId;
          const filled = ready(node);
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode(node.id)}
              className={`absolute overflow-hidden border px-3 py-2 text-left ${active ? "border-olive-400 bg-olive-950" : "border-zinc-700 bg-zinc-900 hover:border-olive-600"}`}
              style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">Ситуація {node.label}</span>
              <span className={`mt-1 line-clamp-2 text-sm leading-5 ${filled ? "text-zinc-100" : "text-zinc-500"}`}>
                {(node.prompt || "").trim() || "Ще не описано"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
