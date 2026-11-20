import { useMemo, useState } from "react";
import ScenarioGraph from "../components/ScenarioGraph";
import { apiTreeFromForm, blankOption, buildTree, countNodes, createLinkedOption, createNode, createOption, findNode, formTreeFromApi, optionLetter, removeNode, replaceNode } from "../scenarioTree";
import { partsFromSeconds, secondsFromParts } from "../timer";

function blankStep() {
  return { id: "", prompt: "", options: [blankOption("a"), blankOption("b")] };
}

function formOption(option, index = 0) {
  const source = option && typeof option === "object" ? option : {};
  const badges = Array.isArray(source.badges)
    ? source.badges
    : String(source.badges || "").split(",");
  const legalRef = Array.isArray(source.legalRefs) ? source.legalRefs[0] : null;
  const deltas = source.deltas && typeof source.deltas === "object" ? source.deltas : {};
  return {
    ...blankOption(String(source.id || `option-${index + 1}`)),
    title: typeof source.title === "string" ? source.title : "",
    text: typeof source.text === "string" ? source.text : "",
    badges: badges.filter((badge) => typeof badge === "string").join(", "),
    analysis: typeof source.analysis === "string" ? source.analysis : "",
    deferred: typeof source.deferred === "string" ? source.deferred : "",
    legal: typeof source.legal === "string" ? source.legal : "",
    legalTitle: typeof legalRef?.title === "string" ? legalRef.title : (typeof source.legalTitle === "string" ? source.legalTitle : ""),
    legalHref: typeof legalRef?.href === "string" ? legalRef.href : (typeof source.legalHref === "string" ? source.legalHref : ""),
    integrity: safeDelta(deltas.integrity ?? source.integrity),
    trust: safeDelta(deltas.trust ?? source.trust),
    effectiveness: safeDelta(deltas.effectiveness ?? source.effectiveness),
    nextStepId: typeof source.nextStepId === "string" ? source.nextStepId : "",
    end: source.end === true
  };
}

function safeDelta(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-40, Math.min(0, number)) : 0;
}

function graphFromSteps(steps) {
  const sourceSteps = Array.isArray(steps) ? steps : [];
  const usedIds = new Set();
  const nodes = sourceSteps.map((step, index) => {
    const source = step && typeof step === "object" ? step : {};
    const baseId = typeof source.id === "string" && source.id.trim() ? source.id.trim() : `step-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    return {
      id,
      sourceId: baseId,
      label: String(index + 1),
      prompt: typeof source.prompt === "string" ? source.prompt : "",
      options: (Array.isArray(source.options) ? source.options : []).map(formOption)
    };
  });
  const byId = new Map();
  nodes.forEach((node) => {
    if (!byId.has(node.sourceId)) byId.set(node.sourceId, node);
    byId.set(node.id, node);
  });
  nodes.forEach((node, index) => {
    node.options.forEach((option) => {
      const implicitNext = nodes[index + 1]?.id;
      option.next = option.end ? null : byId.get(option.nextStepId || implicitNext) || null;
      delete option.nextStepId;
      delete option.end;
    });
    delete node.sourceId;
  });
  return nodes[0] || createNode("1");
}

function digits(value, max) {
  return String(value || "").replace(/[^\d]/g, "").slice(0, max);
}

function fromCase(item, visualGraph = false) {
  const inherited = item?.timeMode === "case" || item?.timeMode === "step"
    ? item.timeMode
    : (Number(item?.timeLimitSeconds) > 0 ? "case" : "none");
  const limit = partsFromSeconds(inherited === "none" ? 0 : item?.timeLimitSeconds);
  const shared = {
    title: item?.title || "",
    field: item?.field || "",
    summary: item?.summary || "",
    visibility: item?.visibility === "public" || item?.status === "published" || item?.status === "pending" ? "public" : "local",
    status: item?.status || "local",
    timeMode: inherited,
    timeMinutes: limit.minutes,
    timeSeconds: inherited === "step" ? limit.seconds : "",
    normsText: (Array.isArray(item?.norms) ? item.norms : [])
      .filter((norm) => norm && typeof norm === "object")
      .map((norm) => {
        const title = typeof norm.title === "string" ? norm.title : "";
        const href = typeof norm.href === "string" ? norm.href : "";
        return href ? `${title} | ${href}` : title;
      }).join("\n")
  };
  if (!item) return { ...shared, mode: "tree", tree: buildTree(1, 2), steps: [] };
  if (item.tree) return { ...shared, mode: "tree", tree: formTreeFromApi(item.tree) || createNode("1"), steps: [] };
  const steps = (Array.isArray(item.steps) ? item.steps : []).map((step) => ({
    id: typeof step?.id === "string" ? step.id : "",
    prompt: typeof step?.prompt === "string" ? step.prompt : "",
    options: (Array.isArray(step?.options) ? step.options : []).map(formOption)
  }));
  if (visualGraph) {
    return { ...shared, mode: "graph", tree: graphFromSteps(steps), steps: [] };
  }
  return {
    ...shared,
    mode: "linear",
    tree: null,
    steps
  };
}

function normsFromText(value) {
  return value.split("\n").map((line) => {
    const [title, href] = line.split("|").map((part) => part.trim());
    return title ? { title, href: href || "" } : null;
  }).filter(Boolean);
}

function linearSteps(steps) {
  return steps.map((step) => ({
    id: step.id,
    prompt: step.prompt,
    options: step.options.map((option) => ({
      id: option.id,
      title: option.title,
      text: option.text,
      badges: option.badges,
      analysis: option.analysis,
      deferred: option.deferred,
      legal: option.legal,
      legalTitle: option.legalTitle,
      legalHref: option.legalHref,
      nextStepId: option.nextStepId || "",
      end: option.end === true,
      deltas: {
        integrity: Math.min(0, Number(option.integrity) || 0),
        trust: Math.min(0, Number(option.trust) || 0),
        effectiveness: Math.min(0, Number(option.effectiveness) || 0)
      }
    }))
  }));
}

function graphSteps(root) {
  const nodes = [];
  const seen = new Set();
  function visit(node) {
    if (!node || seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
    (node.options || []).forEach((option) => visit(option.next));
  }
  visit(root);
  return linearSteps(nodes.map((node) => ({
    id: node.id,
    prompt: node.prompt,
    options: (node.options || []).map((option) => ({
      ...option,
      nextStepId: option.next?.id || "",
      end: !option.next
    }))
  })));
}

function toPayload(form) {
  const shared = {
    title: form.title,
    field: form.field,
    summary: form.summary,
    visibility: form.visibility,
    status: form.status,
    norms: normsFromText(form.normsText),
    timeMode: form.timeMode || "none",
    timeLimitSeconds: form.timeMode === "none" ? 0 : secondsFromParts(form.timeMinutes, form.timeMode === "step" ? form.timeSeconds : 0)
  };
  if (form.mode === "tree") {
    return {
      ...shared,
      tree: apiTreeFromForm(form.tree)
    };
  }
  if (form.mode === "graph") {
    return { ...shared, steps: graphSteps(form.tree) };
  }
  return { ...shared, steps: linearSteps(form.steps) };
}

function OptionFields({ option, onChange }) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="text-sm text-zinc-300 md:col-span-2">Назва відповіді
        <input required value={option.title} onChange={(event) => onChange({ title: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
      </label>
      <label className="text-sm text-zinc-300 md:col-span-2">Текст дії
        <input value={option.text} onChange={(event) => onChange({ text: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
      </label>
      <label className="text-sm text-zinc-300 md:col-span-2">Пояснення для учасника
        <textarea value={option.analysis} onChange={(event) => onChange({ analysis: event.target.value })} className="mt-2 min-h-20 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
      </label>
      <label className="text-sm text-zinc-300">Відкладені наслідки
        <textarea value={option.deferred} onChange={(event) => onChange({ deferred: event.target.value })} className="mt-2 min-h-20 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
      </label>
      <label className="text-sm text-zinc-300">Правова опора
        <textarea value={option.legal} onChange={(event) => onChange({ legal: event.target.value })} className="mt-2 min-h-20 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
      </label>
      {["integrity", "trust", "effectiveness"].map((key) => {
        const label = key === "integrity" ? "Доброчесність" : key === "trust" ? "Довіра" : "Ефективність";
        const value = Math.max(-40, Math.min(0, Number(option[key]) || 0));
        return (
          <fieldset key={key} className="border border-zinc-800 p-3 text-sm text-zinc-300">
            <legend>{label}</legend>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" aria-label={`Зменшити ${label}`} onClick={() => onChange({ [key]: Math.max(-40, value - 1) })} className="h-10 w-10 border border-zinc-700 text-xl text-zinc-200">−</button>
              <input type="number" min="-40" max="0" value={value} onChange={(event) => onChange({ [key]: Math.max(-40, Math.min(0, Number(event.target.value) || 0)) })} className="h-10 w-20 border border-zinc-700 bg-zinc-950 text-center text-zinc-100" />
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function draftFromNode(node) {
  return {
    prompt: node.prompt || "",
    options: (node.options || []).map((option) => ({ ...option, next: option.next }))
  };
}

function mergeDraft(node, draft) {
  return {
    ...node,
    prompt: draft.prompt,
    options: (draft.options || []).map((option) => ({ ...option }))
  };
}

function firstGap(node) {
  if (!node) return null;
  if ((node.prompt || "").trim().length < 10) return node;
  if ((node.options || []).length < 2) return node;
  const untitled = (node.options || []).find((option) => (option.title || "").trim().length < 2);
  if (untitled) return node;
  for (const option of node.options || []) {
    const nested = firstGap(option.next);
    if (nested) return nested;
  }
  return null;
}

export default function CaseEditor({ initial, role, pending, error, success, draftCases = [], onSave, onSaveDraft, onDeleteDraft, onContinueDraft, onDirtyChange, onCancel }) {
  const [form, setForm] = useState(() => fromCase(initial, role === "superadmin" && !initial?.tree));
  const [selectedId, setSelectedId] = useState("");
  const [optionFocus, setOptionFocus] = useState("");
  const [draft, setDraft] = useState(null);
  const [graphNote, setGraphNote] = useState("");
  const [localError, setLocalError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState("");
  const [graphZoom, setGraphZoom] = useState(1);
  const selected = form.tree && selectedId ? findNode(form.tree, selectedId) : null;
  const liveTree = form.tree && draft && selected ? replaceNode(form.tree, selected.id, mergeDraft(selected, draft)) : form.tree;
  const payload = useMemo(() => toPayload({ ...form, tree: liveTree }), [form, liveTree]);
  const builtin = initial?.source === "builtin";
  const branching = form.mode === "tree" || form.mode === "graph";

  function markDirty() {
    setDirty(true);
    onDirtyChange?.(true);
  }

  function updateDraft(nextDraft) {
    markDirty();
    setDraft(nextDraft);
  }

  function patch(partial) {
    markDirty();
    setForm((current) => ({ ...current, ...partial }));
  }

  function patchStep(index, partial) {
    markDirty();
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...partial } : step))
    }));
  }

  function patchOption(stepIndex, optionIndex, partial) {
    const step = form.steps[stepIndex];
    patchStep(stepIndex, {
      options: step.options.map((option, index) => (index === optionIndex ? { ...option, ...partial } : option))
    });
  }

  function storedTree() {
    if (!form.tree || !draft || !selected) return form.tree;
    return replaceNode(form.tree, selected.id, mergeDraft(selected, draft));
  }

  function openNode(id, tree = storedTree()) {
    const node = findNode(tree, id);
    setForm((current) => ({ ...current, tree }));
    setSelectedId(node ? id : "");
    setOptionFocus("");
    setDraft(node ? draftFromNode(node) : null);
    setGraphNote("");
  }

  function openOption(nodeId, optionId) {
    const tree = storedTree();
    const node = findNode(tree, nodeId);
    const option = node?.options?.find((item) => item.id === optionId);
    setForm((current) => ({ ...current, tree }));
    setSelectedId(node ? nodeId : "");
    setOptionFocus(option ? optionId : "");
    setDraft(node ? draftFromNode(node) : null);
    setGraphNote("");
  }

  function applyDraft() {
    if (!selected || !draft) return;
    const tree = replaceNode(form.tree, selected.id, mergeDraft(selected, draft));
    setForm((current) => ({ ...current, tree }));
    setDraft(draftFromNode(findNode(tree, selected.id)));
    setGraphNote("Схему оновлено. Текст вузла вже на графі.");
  }

  function changeDraft(nextDraft, note) {
    markDirty();
    setDraft(nextDraft);
    setGraphNote(note);
    setLocalError("");
  }

  function addOption() {
    if (!draft || !selected) return;
    changeDraft(
      { ...draft, options: [...draft.options, createLinkedOption(selected.label, draft.options.length)] },
      "Варіант додано. Нова гілка вже на схемі."
    );
  }

  function removeOption(index) {
    if (!draft || draft.options.length <= 1) return;
    if (draft.options[index]?.id === optionFocus) setOptionFocus("");
    changeDraft(
      { ...draft, options: draft.options.filter((_, optionIndex) => optionIndex !== index) },
      "Варіант і його гілку прибрано зі схеми."
    );
  }

  function extendOption(index) {
    if (!draft || !selected || draft.options[index]?.next) return;
    const letter = optionLetter(index);
    changeDraft({
      ...draft,
      options: draft.options.map((option, optionIndex) => (
        optionIndex === index ? { ...option, next: createNode(`${selected.label}${letter}`) } : option
      ))
    }, `Додано наступний етап ${selected.label}${letter}.`);
  }

  function addNextFromGraph(nodeId, optionId) {
    const tree = storedTree();
    const node = findNode(tree, nodeId);
    const optionIndex = node?.options?.findIndex((option) => option.id === optionId) ?? -1;
    const option = node?.options?.[optionIndex];
    if (!node || !option || option.next) return;
    markDirty();
    const updatedNode = {
      ...node,
      options: node.options.map((item, index) => (
        index === optionIndex
          ? { ...item, next: createNode(`${node.label}${optionLetter(index)}`) }
          : item
      ))
    };
    const updatedTree = replaceNode(tree, nodeId, updatedNode);
    setForm((current) => ({ ...current, tree: updatedTree }));
    setSelectedId(nodeId);
    setOptionFocus(optionId);
    setDraft(draftFromNode(updatedNode));
    setGraphNote(`Додано наступне питання після відповіді ${optionLetter(optionIndex)}.`);
  }

  function addOptionFromGraph(nodeId) {
    const tree = storedTree();
    const node = findNode(tree, nodeId);
    if (!node) return;
    markDirty();
    const updatedNode = {
      ...node,
      options: [...(node.options || []), createOption()]
    };
    const updatedTree = replaceNode(tree, nodeId, updatedNode);
    setForm((current) => ({ ...current, tree: updatedTree }));
    setSelectedId(nodeId);
    setOptionFocus("");
    setDraft(draftFromNode(updatedNode));
    setGraphNote("Відповідь додано до питання.");
  }

  function endBranch(index) {
    if (!draft?.options[index]?.next) return;
    changeDraft({
      ...draft,
      options: draft.options.map((option, optionIndex) => (
        optionIndex === index ? { ...option, next: null } : option
      ))
    }, "Наступний етап цієї відповіді прибрано.");
  }

  function removeQuestion() {
    if (!selected) return;
    markDirty();
    let nextTree;
    if (selected.id === form.tree?.id) {
      const children = [...new Map(
        (selected.options || []).filter((option) => option.next).map((option) => [option.next.id, option.next])
      ).values()];
      if (children.length === 1) {
        nextTree = children[0];
      } else if (children.length > 1) {
        nextTree = createNode("1");
        nextTree.options = children.map((child, index) => ({
          ...blankOption(`root-${index + 1}`),
          title: `Перейти до питання ${child.label}`,
          next: child
        }));
      } else {
        nextTree = createNode("1");
      }
      setGraphNote("Питання видалено.");
    } else {
      nextTree = removeNode(form.tree, selected.id);
    }
    setForm((current) => ({ ...current, tree: nextTree }));
    setSelectedId("");
    setOptionFocus("");
    setDraft(null);
    setGraphNote("Питання видалено.");
  }

  function saveCase(event) {
    event.preventDefault();
    const tree = storedTree();
    if (branching) {
      const gap = firstGap(tree);
      if (gap) {
        setLocalError(`Питання ${gap.label} ще не заповнене: потрібен текст питання і назва кожного варіанта.`);
        const node = findNode(tree, gap.id);
        setForm((current) => ({ ...current, tree }));
        setSelectedId(gap.id);
        setOptionFocus("");
        setDraft(node ? draftFromNode(node) : null);
        return;
      }
    }
    if (form.timeMode === "case" && secondsFromParts(form.timeMinutes, 0) < 60) {
      setLocalError("Для всього тесту вкажіть щонайменше одну хвилину.");
      return;
    }
    if (form.timeMode === "step" && secondsFromParts(form.timeMinutes, form.timeSeconds) < 1) {
      setLocalError("Вкажіть, скільки часу дається на кожне завдання.");
      return;
    }
    setLocalError("");
    onSave(toPayload({ ...form, tree }));
  }

  async function saveDraft() {
    setLocalError("");
    const tree = storedTree();
    const saved = await onSaveDraft(toPayload({ ...form, tree }));
    if (saved) {
      setDirty(false);
      onDirtyChange?.(false);
    }
  }

  function continueDraft(item) {
    if (dirty && !window.confirm("Поточні незбережені зміни буде втрачено. Відкрити вибрану чернетку?")) return;
    setDirty(false);
    setShowDrafts(false);
    onDirtyChange?.(false);
    onContinueDraft(item);
  }

  async function deleteDraft(item) {
    if (!window.confirm("Видалити цю чернетку? Цю дію не можна скасувати.")) return;
    setLocalError("");
    setDeletingDraftId(item.id);
    try {
      await onDeleteDraft(item);
    } catch (deleteError) {
      setLocalError(`Не вдалося видалити чернетку: ${deleteError.message}`);
    } finally {
      setDeletingDraftId("");
    }
  }

  return (
    <section className={`w-full transition-all duration-300 ${draft && selected ? "lg:pr-[25rem]" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">{initial ? "Редагування" : "Новий кейс"}</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">{branching ? "Дерево сценарію" : "Лінійний кейс"}</h1>
        </div>
        <button type="button" onClick={onCancel} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300">Назад</button>
      </div>
      {role === "organizer" ? (
        <div className="mt-4">
          <button type="button" onClick={() => setShowDrafts((value) => !value)} className="border border-zinc-700 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-olive-200 hover:border-olive-500">
            {showDrafts ? "Повернутися до конструктора" : `Незавершені кейси (${draftCases.length})`}
          </button>
          {showDrafts ? (
            <section className="mt-4 border border-zinc-800 bg-zinc-950/70 p-4">
              <h2 className="font-display text-2xl text-zinc-50">Мої незавершені кейси</h2>
              {draftCases.length ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {draftCases.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 border border-zinc-800 p-3">
                      <button type="button" onClick={() => continueDraft(item)} className="flex min-w-0 flex-1 items-center justify-between gap-4 p-1 text-left hover:text-olive-200">
                        <span className="min-w-0">
                          <span className="block truncate font-display text-xl text-zinc-100">{item.title || "Чернетка без назви"}</span>
                          <span className="mt-1 block truncate text-sm text-zinc-400">{item.field || "Тему ще не вказано"} · оновлено {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("uk-UA") : "щойно"}</span>
                        </span>
                        <span className="shrink-0 border border-olive-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-olive-200">Продовжити</span>
                      </button>
                      <button type="button" disabled={Boolean(deletingDraftId)} onClick={() => deleteDraft(item)} className="shrink-0 border border-red-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-red-300 hover:border-red-600 disabled:opacity-50">
                        {deletingDraftId === item.id ? "Видаляємо…" : "Видалити"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-zinc-400">Збережених незавершених кейсів поки немає.</p>}
            </section>
          ) : null}
        </div>
      ) : null}
      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
        {branching
          ? "Новий кейс одразу починається з питання 1 і двох варіантів, А та Б. Клік по питанню або варіанту відкриває форму редагування; бали можна змінювати кнопками «+» і «−», а наступне питання — окремим переходом."
          : "Цей кейс уже зібраний як послідовність кроків. Нові кейси будуються деревом рішень."}
      </p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={saveCase}>
        <div className="grid gap-4 border border-zinc-800 bg-zinc-900/80 p-5 md:grid-cols-2">
          <label className="text-sm text-zinc-300 md:col-span-2">Тема
            <input required value={form.field} onChange={(event) => patch({ field: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
          </label>
          <label className="text-sm text-zinc-300 md:col-span-2">Назва
            <input required value={form.title} onChange={(event) => patch({ title: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
          </label>
          <label className="text-sm text-zinc-300 md:col-span-2">Короткий опис
            <textarea value={form.summary} onChange={(event) => patch({ summary: event.target.value })} className="mt-2 min-h-24 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
          </label>
          <label className="text-sm text-zinc-300 md:col-span-2">Нормативні документи, по одному рядку: назва | посилання
            <textarea value={form.normsText} onChange={(event) => patch({ normsText: event.target.value })} className="mt-2 min-h-24 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
          </label>
          <fieldset className="text-sm text-zinc-300 md:col-span-2">
            <legend>Обмеження часу</legend>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Один режим на весь кейс. Без обмежень відлік не з’являється. На весь тест нуль закриває проходження. На кожне завдання нуль відкриває наступний етап.</p>
            <label className="mt-3 flex items-center gap-2">
              <input type="radio" name="timeMode" checked={form.timeMode === "none"} onChange={() => patch({ timeMode: "none" })} />
              Без обмежень часу
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input type="radio" name="timeMode" checked={form.timeMode === "case"} onChange={() => patch({ timeMode: "case" })} />
              На весь тест
            </label>
            {form.timeMode === "case" ? (
              <label className="mt-2 block max-w-xs">Хвилини на весь кейс
                <input inputMode="numeric" value={form.timeMinutes || ""} onChange={(event) => patch({ timeMinutes: digits(event.target.value, 3) })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" placeholder="наприклад 10" />
              </label>
            ) : null}
            <label className="mt-2 flex items-center gap-2">
              <input type="radio" name="timeMode" checked={form.timeMode === "step"} onChange={() => patch({ timeMode: "step" })} />
              На кожне окреме завдання
            </label>
            {form.timeMode === "step" ? (
              <div className="mt-2 flex max-w-md gap-2">
                <label className="flex-1">Хвилини на завдання
                  <input inputMode="numeric" value={form.timeMinutes || ""} onChange={(event) => patch({ timeMinutes: digits(event.target.value, 3) })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" placeholder="0" />
                </label>
                <label className="flex-1">Секунди на завдання
                  <input inputMode="numeric" value={form.timeSeconds || ""} onChange={(event) => patch({ timeSeconds: digits(event.target.value, 4) })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" placeholder="0" />
                </label>
              </div>
            ) : null}
          </fieldset>
          <fieldset className="text-sm text-zinc-300">
            <legend>Доступ</legend>
            <label className="mt-2 flex items-center gap-2">
              <input type="radio" name="visibility" checked={form.visibility === "local"} disabled={builtin} onChange={() => patch({ visibility: "local" })} />
              Локальний, лише на цьому обліковому записі
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input type="radio" name="visibility" checked={form.visibility === "public"} disabled={builtin} onChange={() => patch({ visibility: "public" })} />
              Публічний, на розгляд супер-адміна
            </label>
          </fieldset>
          {role === "superadmin" && initial?.source === "custom" ? (
            <label className="text-sm text-zinc-300">Статус модерації
              <select value={form.status} onChange={(event) => patch({ status: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100">
                <option value="pending">На розгляді</option>
                <option value="published">У публічному доступі</option>
                <option value="rejected">Приховано</option>
                <option value="local">Локальний</option>
              </select>
            </label>
          ) : null}
        </div>

        {branching && form.tree ? (
          <section className="min-w-0 w-full">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-zinc-50">Схема сценарію</h2>
                <p className="mt-1 text-sm text-zinc-400">Питання показано в прямокутнику. Під ним — варіанти відповідей, а стрілка веде до наступного питання.</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="mr-2 font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">{countNodes(liveTree || form.tree)} питань</p>
                <button type="button" aria-label="Зменшити масштаб дерева" onClick={() => setGraphZoom((zoom) => Math.max(0.5, Math.round((zoom - 0.1) * 100) / 100))} className="border border-zinc-700 px-3 py-2 font-mono text-sm text-zinc-200 hover:border-olive-500">−</button>
                <span className="min-w-12 text-center font-mono text-xs text-zinc-300">{Math.round(graphZoom * 100)}%</span>
                <button type="button" aria-label="Збільшити масштаб дерева" onClick={() => setGraphZoom((zoom) => Math.min(2, Math.round((zoom + 0.1) * 100) / 100))} className="border border-zinc-700 px-3 py-2 font-mono text-sm text-zinc-200 hover:border-olive-500">+</button>
                <button type="button" onClick={() => setGraphZoom(1)} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-300 hover:border-olive-500">Скинути</button>
              </div>
            </div>
            
            <ScenarioGraph
              tree={liveTree || form.tree}
              selectedId={selectedId}
              selectedOptionId={optionFocus}
              onSelectNode={openNode}
              onSelectOption={openOption}
              onAddNext={addNextFromGraph}
              onAddOption={addOptionFromGraph}
              zoom={graphZoom}
              onZoomChange={(zoom) => setGraphZoom(Math.max(0.5, Math.min(2, Math.round(zoom * 100) / 100)))}
            />
          </section>
        ) : null}

        {branching && draft && selected ? (
          <aside className="fixed top-[115px] bottom-0 right-0 z-40 flex h-[calc(100vh-115px)] w-full flex-col border-l border-zinc-700 bg-zinc-950 shadow-2xl sm:w-[min(36rem,100vw)]">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">Питання {selected.label}</p>
                <h2 className="mt-1 font-display text-3xl text-zinc-50">{draft.options.some((option) => option.id === optionFocus) ? `Варіант ${optionLetter(draft.options.findIndex((option) => option.id === optionFocus))}` : "Питання"}</h2>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={removeQuestion} className="border border-red-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-red-300">Видалити питання</button>
                <button type="button" onClick={() => { applyDraft(); setSelectedId(""); setOptionFocus(""); setDraft(null); }} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300">Закрити</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {(() => {
                const focusIndex = draft.options.findIndex((option) => option.id === optionFocus);
                const option = focusIndex >= 0 ? draft.options[focusIndex] : null;
                if (!option) {
                  return (
                    <>
                      <label className="block text-sm text-zinc-300">Текст питання
                        <textarea value={draft.prompt} onChange={(event) => updateDraft({ ...draft, prompt: event.target.value })} className="mt-2 min-h-28 w-full border border-zinc-700 bg-zinc-900 px-3 py-3 text-zinc-100" />
                      </label>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">Варіанти відповіді</p>
                        <button type="button" onClick={addOption} className="border border-olive-600 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-olive-100">+ Додати варіант</button>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        {draft.options.map((item, index) => (
                          <button key={item.id} type="button" onClick={() => setOptionFocus(item.id)} className="border border-zinc-800 px-3 py-3 text-left hover:border-olive-600">
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-olive-300">Варіант {optionLetter(index)}</span>
                            <span className="mt-1 block text-sm text-zinc-200">{item.title || "Ще без назви"}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  );
                }
                return (
                  <>
                    <button type="button" onClick={() => setOptionFocus("")} className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">До питання {selected.label}</button>
                    <div className="mt-4 border border-zinc-800 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">Варіант {optionLetter(focusIndex)}</p>
                        <button type="button" onClick={() => removeOption(focusIndex)} disabled={draft.options.length <= 1} className="border border-zinc-700 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300 disabled:opacity-40">− Видалити</button>
                      </div>
                      <OptionFields option={option} onChange={(partial) => updateDraft({
                        ...draft,
                        options: draft.options.map((item, optionIndex) => (optionIndex === focusIndex ? { ...item, ...partial } : item))
                      })} />
                      <div className="mt-3 border border-zinc-800 bg-zinc-900/70 p-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Перехід</p>
                        {option.next ? (
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <button type="button" onClick={() => openNode(option.next.id)} className="text-left text-sm text-olive-200 underline decoration-zinc-700 underline-offset-4">
                              Веде до ситуації {option.next.label}
                            </button>
                            <button type="button" onClick={() => endBranch(focusIndex)} className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">− Прибрати етап</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => extendOption(focusIndex)} className="mt-2 border border-olive-700 px-3 py-2 text-sm text-olive-100">+ Наступний етап</button>
                        )}
                      </div>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-zinc-500">Доброчесність, довіра й ефективність тут — зміна шкали від −40 до 0. Підсумок учасника лишається в межах 0–100.</p>
                  </>
                );
              })()}
            </div>
            <div className="border-t border-zinc-800 px-5 py-4">
              <p className="mb-3 min-h-5 text-sm text-olive-300">{graphNote}</p>
              <button type="button" onClick={applyDraft} className="w-full border border-olive-600 bg-olive-800 px-4 py-3 font-display text-xl tracking-[0.08em] text-olive-100">Оновити схему</button>
            </div>
          </aside>
        ) : null}

        {!branching ? form.steps.map((step, stepIndex) => (
          <article key={`step-${stepIndex}`} className="border border-zinc-800 bg-zinc-950/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl text-zinc-50">Крок {stepIndex + 1}</h2>
              {form.steps.length > 1 ? (
                <button type="button" onClick={() => patch({ steps: form.steps.filter((_, index) => index !== stepIndex) })} className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">Прибрати крок</button>
              ) : null}
            </div>
            <label className="mt-3 block text-sm text-zinc-300">Питання
              <textarea required value={step.prompt} onChange={(event) => patchStep(stepIndex, { prompt: event.target.value })} className="mt-2 min-h-28 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
            </label>
            <div className="mt-4 flex flex-col gap-4">
              {step.options.map((option, optionIndex) => (
                <div key={`${stepIndex}-${option.id}`} className="border border-zinc-800 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-400">Варіант {optionIndex + 1}</p>
                  <OptionFields option={option} onChange={(partial) => patchOption(stepIndex, optionIndex, partial)} />
                </div>
              ))}
            </div>
          </article>
        )) : null}
        {!branching && form.steps.length < 8 ? (
          <button type="button" onClick={() => patch({ steps: [...form.steps, blankStep()] })} className="border border-zinc-700 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-300">Додати крок</button>
        ) : null}

        <p className="min-h-5 text-sm text-amber-400">{localError || error}</p>
        {success ? <p className="text-sm text-olive-300" role="status">{success}</p> : null}
        <button type="submit" disabled={pending || (branching && !form.tree)} className="border border-olive-600 bg-olive-800 px-5 py-3 font-display text-xl tracking-[0.1em] text-olive-100 disabled:opacity-50">
          {pending ? "Зберігаємо" : "Зберегти кейс"}
        </button>
        {role === "organizer" ? (
          <button type="button" disabled={pending} onClick={saveDraft} className="border border-zinc-600 px-5 py-3 font-display text-xl tracking-[0.06em] text-zinc-200 disabled:opacity-50">
            {pending ? "Зберігаємо…" : "Зберегти незавершений кейс (чернетку)"}
          </button>
        ) : null}
      </form>
    </section>
  );
}
