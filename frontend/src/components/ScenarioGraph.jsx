import { LETTERS } from "../scenarioTree";

const NODE_W = 292;
const HEADER_H = 104;
const OPTION_H = 50;
const ADD_OPTION_H = 44;
const NODE_GAP = 32;
const COL = 390;
const PAD = 28;

function nodeHeight(node) {
  return HEADER_H + Math.max(1, node.options?.length || 0) * OPTION_H + ADD_OPTION_H;
}

function subtreeHeight(node) {
  const children = (node.options || []).map((option) => option.next).filter(Boolean);
  if (!children.length) return nodeHeight(node);
  const childrenHeight = children.reduce((sum, child) => sum + subtreeHeight(child), 0)
    + NODE_GAP * (children.length - 1);
  return Math.max(nodeHeight(node), childrenHeight);
}

function layout(node, depth, top, nodes, edges) {
  const height = subtreeHeight(node);
  const cardHeight = nodeHeight(node);
  const x = PAD + depth * COL;
  const y = top + (height - cardHeight) / 2;
  const positioned = { node, x, y, height: cardHeight };
  nodes.push(positioned);

  const branches = (node.options || [])
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option.next);
  const childrenHeight = branches.reduce((sum, { option }) => sum + subtreeHeight(option.next), 0)
    + NODE_GAP * Math.max(0, branches.length - 1);
  let childTop = top + (height - childrenHeight) / 2;

  branches.forEach(({ option, index }) => {
    const childHeight = subtreeHeight(option.next);
    const child = layout(option.next, depth + 1, childTop, nodes, edges);
    edges.push({
      from: positioned,
      to: child,
      index,
      letter: LETTERS[index] || String(index + 1),
      optionId: option.id
    });
    childTop += childHeight + NODE_GAP;
  });
  return positioned;
}

export default function ScenarioGraph({
  tree,
  selectedId,
  selectedOptionId,
  onSelectNode,
  onSelectOption,
  onAddNext,
  onAddOption
}) {
  const nodes = [];
  const edges = [];
  layout(tree, 0, PAD, nodes, edges);
  const width = Math.max(...nodes.map((item) => item.x + NODE_W)) + PAD;
  const height = Math.max(...nodes.map((item) => item.y + item.height)) + PAD;

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
            const x1 = edge.from.x + NODE_W;
            const y1 = edge.from.y + HEADER_H + edge.index * OPTION_H + OPTION_H / 2;
            const x2 = edge.to.x;
            const y2 = edge.to.y + HEADER_H / 2;
            const bend = x1 + (x2 - x1) / 2;
            return (
              <g key={`${edge.from.node.id}-${edge.optionId}`}>
                <path
                  d={`M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${x2 - 3} ${y2}`}
                  fill="none"
                  stroke="#596b2b"
                  strokeWidth="2"
                  markerEnd="url(#scenario-arrow)"
                />
                <text
                  x={bend}
                  y={(y1 + y2) / 2 - 6}
                  textAnchor="middle"
                  fill="#d9e3a4"
                  fontFamily="IBM Plex Mono, monospace"
                  fontSize="12"
                  fontWeight="600"
                >
                  {edge.letter}
                </text>
              </g>
            );
          })}
        </svg>
        {nodes.map(({ node, x, y, height: cardHeight }) => {
          const active = node.id === selectedId && !selectedOptionId;
          return (
            <article
              key={node.id}
              className={`absolute overflow-hidden border ${active ? "border-olive-400 bg-olive-950" : "border-zinc-700 bg-zinc-900"}`}
              style={{ left: x, top: y, width: NODE_W, height: cardHeight }}
            >
              <button
                type="button"
                onClick={() => onSelectNode(node.id)}
                className="block h-[104px] w-full border-b border-zinc-700 px-3 py-2 text-left hover:bg-olive-950/70"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">Питання {node.label}</span>
                <span className={`mt-1 block line-clamp-3 text-sm leading-5 ${(node.prompt || "").trim() ? "text-zinc-100" : "text-zinc-500"}`}>
                  {(node.prompt || "").trim() || "Натисніть, щоб додати текст питання"}
                </span>
              </button>
              {(node.options || []).map((option, index) => {
                const letter = LETTERS[index] || String(index + 1);
                const selected = node.id === selectedId && option.id === selectedOptionId;
                return (
                  <div key={option.id} className="flex h-[50px] items-center gap-2 border-b border-zinc-800 px-2 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onSelectOption(node.id, option.id)}
                      title={option.title || `Відповідь ${letter}`}
                      className={`min-w-0 flex-1 truncate border px-2 py-1.5 text-left text-xs ${selected ? "border-olive-400 bg-olive-900 text-olive-100" : "border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-olive-600"}`}
                    >
                      <span className="mr-2 font-mono text-[10px] uppercase text-olive-300">{letter}</span>
                      {option.title?.trim() || `Відповідь ${letter}`}
                    </button>
                    {!option.next ? (
                      <button
                        type="button"
                        onClick={() => onAddNext(node.id, option.id)}
                        aria-label={`Додати наступне питання після відповіді ${letter}`}
                        title={`Додати наступне питання після відповіді ${letter}`}
                        className="grid h-8 w-8 shrink-0 place-items-center border border-olive-700 font-mono text-sm text-olive-200 hover:border-olive-400 hover:bg-olive-900"
                      >
                        +
                      </button>
                    ) : (
                      <span className="w-8 shrink-0 text-center font-mono text-[10px] text-olive-400" aria-hidden="true">→</span>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => onAddOption(node.id)}
                className="flex h-[44px] w-full items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-olive-300 hover:bg-olive-950/70 hover:text-olive-100"
              >
                <span aria-hidden="true" className="text-sm">+</span>
                Додати відповідь
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
