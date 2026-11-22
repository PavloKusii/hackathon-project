import { useEffect, useRef, useState } from "react";
import { LETTERS } from "../scenarioTree";

const NODE_W = 292;
const HEADER_H = 104;
const OPTION_H = 50;
const ADD_OPTION_H = 44;
const NODE_GAP = 32;
const COL = 390;
const PAD = 28;

function nodeHeight(node) {
  const optionCount = Array.isArray(node?.options) ? node.options.length : 0;
  return HEADER_H + Math.max(1, optionCount) * OPTION_H + ADD_OPTION_H;
}

function layout(root) {
  const graphNodes = [];
  const graphEdges = [];
  const byId = new Map();
  function collect(node) {
    if (!node || typeof node !== "object" || typeof node.id !== "string" || !node.id || byId.has(node.id)) return;
    byId.set(node.id, node);
    graphNodes.push(node);
    (Array.isArray(node.options) ? node.options : []).forEach((option, index) => {
      if (!option || typeof option !== "object" || !option.next) return;
      graphEdges.push({ fromId: node.id, toId: option.next.id, option, index });
      collect(option.next);
    });
  }
  collect(root);
  if (!graphNodes.length) return { nodes: [], edges: [] };

  const indegree = new Map(graphNodes.map((node) => [node.id, 0]));
  const outgoing = new Map(graphNodes.map((node) => [node.id, []]));
  graphEdges.forEach((edge) => {
    if (!indegree.has(edge.toId)) return;
    indegree.set(edge.toId, (indegree.get(edge.toId) || 0) + 1);
    outgoing.get(edge.fromId)?.push(edge);
  });
  const ready = graphNodes.filter((node) => indegree.get(node.id) === 0);
  const depth = new Map([[root.id, 0]]);
  const ordered = [];
  while (ready.length) {
    const node = ready.shift();
    ordered.push(node);
    (outgoing.get(node.id) || []).forEach((edge) => {
      depth.set(edge.toId, Math.max(depth.get(edge.toId) || 0, (depth.get(node.id) || 0) + 1));
      indegree.set(edge.toId, indegree.get(edge.toId) - 1);
      if (indegree.get(edge.toId) === 0) ready.push(byId.get(edge.toId));
    });
  }
  if (ordered.length < graphNodes.length) {
    const level = Math.max(0, ...depth.values()) + 1;
    graphNodes.forEach((node) => {
      if (ordered.includes(node)) return;
      depth.set(node.id, level);
      ordered.push(node);
    });
  }

  const columns = new Map();
  ordered.forEach((node) => {
    const level = depth.get(node.id) || 0;
    if (!columns.has(level)) columns.set(level, []);
    columns.get(level).push(node);
  });
  const positionedById = new Map();
  [...columns.entries()].forEach(([level, nodes]) => {
    let top = PAD;
    nodes.forEach((node) => {
      const positioned = {
        node,
        x: PAD + level * COL,
        y: top,
        height: nodeHeight(node)
      };
      positionedById.set(node.id, positioned);
      top += positioned.height + NODE_GAP;
    });
  });
  const nodes = ordered.map((node) => positionedById.get(node.id));
  const edges = graphEdges.map((edge) => ({
    ...edge,
    from: positionedById.get(edge.fromId),
    to: positionedById.get(edge.toId),
    letter: LETTERS[edge.index] || String(edge.index + 1),
    optionId: edge.option.id
  })).filter((edge) => edge.from && edge.to);
  return { nodes, edges };
}

export default function ScenarioGraph({
                                        tree,
                                        selectedId,
                                        selectedOptionId,
                                        onSelectNode,
                                        onSelectOption,
                                        onAddNext,
                                        onAddOption,
                                        zoom = 1,
                                        onZoomChange
                                      }) {
  const { nodes, edges } = layout(tree);

  // Координати зсуву полотна
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;

  const width = Math.max(420, ...nodes.map((item) => item.x + NODE_W + PAD));
  const height = Math.max(420, ...nodes.map((item) => item.y + item.height + PAD));

  function handleWheel(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    onZoomChange?.(zoom + (event.deltaY < 0 ? 0.08 : -0.08));
  }

  // Натискання миші
  function handleMouseDown(event) {
    if (event.button !== 0) return; // Тільки ліва кнопка
    if (event.target.closest("button, input, a, select")) return; // Не перетягуємо при кліку по кнопках

    setIsDragging(true);
    dragStartRef.current = {
      x: event.clientX - panRef.current.x,
      y: event.clientY - panRef.current.y
    };
  }

  // Глобальні слухачі для плавного перетягування по всьому екрану
  useEffect(() => {
    function handleMouseMove(event) {
      if (!isDragging) return;
      setPan({
        x: event.clientX - dragStartRef.current.x,
        y: event.clientY - dragStartRef.current.y
      });
    }

    function handleMouseUp() {
      setIsDragging(false);
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
      <div
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          className={`relative h-[650px] w-full overflow-hidden rounded border border-zinc-800 bg-zinc-950/90 ${
              isDragging ? "cursor-grabbing select-none" : "cursor-grab"
          }`}
      >
        {/* Кнопка скидання позиції графа */}
        {(pan.x !== 0 || pan.y !== 0) && (
            <button
                type="button"
                onClick={() => setPan({ x: 0, y: 0 })}
                className="absolute bottom-4 right-4 z-30 rounded border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300 shadow-lg hover:border-olive-500 hover:text-zinc-100"
            >
              Скинути позицію
            </button>
        )}

        {/* Головне рухоме полотно */}
        <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: width,
              height: height
            }}
        >
          <svg className="absolute inset-0 pointer-events-none" width={width} height={height} aria-hidden="true">
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
            const options = Array.isArray(node.options) ? node.options : [];
            return (
                <article
                    key={node.id}
                    className={`absolute overflow-hidden border ${
                        active ? "border-olive-400 bg-olive-950 shadow-lg shadow-olive-950/50" : "border-zinc-700 bg-zinc-900"
                    }`}
                    style={{ left: x, top: y, width: NODE_W, height: cardHeight }}
                >
                  <button
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                      className="flex h-[104px] w-full flex-col justify-center overflow-hidden border-b border-zinc-700 px-3 py-2 text-left hover:bg-olive-950/70"
                  >
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">
                  ПИТАННЯ {node.label}
                </span>
                    <span
                        className={`mt-1 block overflow-hidden text-sm leading-5 ${(node.prompt || "").trim() ? "text-zinc-100" : "text-zinc-500"}`}
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          wordBreak: "break-all"
                        }}
                    >
                  {(node.prompt || "").trim() || "Натисніть, щоб додати текст питання"}
                </span>
                  </button>
                  {options.map((rawOption, index) => {
                    const option = rawOption && typeof rawOption === "object"
                        ? rawOption
                        : { id: `option-${index + 1}`, title: "" };
                    const letter = LETTERS[index] || String(index + 1);
                    const selected = node.id === selectedId && option.id === selectedOptionId;
                    return (
                        <div key={option.id} className="flex h-[50px] items-center gap-2 border-b border-zinc-800 px-2 last:border-b-0">
                          <button
                              type="button"
                              onClick={() => onSelectOption(node.id, option.id)}
                              title={option.title || `Відповідь ${letter}`}
                              className={`min-w-0 flex-1 truncate border px-2 py-1.5 text-left text-xs ${
                                  selected ? "border-olive-400 bg-olive-900 text-olive-100" : "border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-olive-600"
                              }`}
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
