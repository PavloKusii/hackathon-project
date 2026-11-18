import { useMemo, useState } from "react";
import ScenarioGraph from "../components/ScenarioGraph";
import { apiTreeFromForm, blankOption, buildTree, countNodes, createLinkedOption, createNode, findNode, formTreeFromApi, optionLetter, replaceNode } from "../scenarioTree";
import { partsFromSeconds, secondsFromParts } from "../timer";

function blankStep() {
  return { id: "", prompt: "", options: [blankOption("a"), blankOption("b")] };
}

function digits(value, max) {
  return String(value || "").replace(/[^\d]/g, "").slice(0, max);
}

function fromCase(item) {
  const inherited = item?.timeMode === "case" || item?.timeMode === "step"
    ? item.timeMode
    : (Number(item?.timeLimitSeconds) > 0 ? "case" : "none");
  const limit = partsFromSeconds(inherited === "none" ? 0 : item?.timeLimitSeconds);
  const shared = {
    code: item?.code || "",
    title: item?.title || "",
    field: item?.field || "",
    summary: item?.summary || "",
    visibility: item?.visibility === "public" || item?.status === "published" || item?.status === "pending" ? "public" : "local",
    status: item?.status || "local",
    timeMode: inherited,
    timeMinutes: limit.minutes,
    timeSeconds: inherited === "step" ? limit.seconds : "",
    normsText: (item?.norms || []).map((norm) => (norm.href ? `${norm.title} | ${norm.href}` : norm.title)).join("\n")
  };
  if (!item) return { ...shared, mode: "tree", tree: buildTree(1, 2), steps: [] };
  if (item.tree) return { ...shared, mode: "tree", tree: formTreeFromApi(item.tree), steps: [] };
  return {
    ...shared,
    mode: "linear",
    tree: null,
    steps: (item.steps || []).map((step) => ({
      id: step.id || "",
      prompt: step.prompt || "",
      options: (step.options || []).map((option) => ({
        ...blankOption(option.id),
        title: option.title || "",
        text: option.text || "",
        badges: (option.badges || []).join(", "),
        analysis: option.analysis || "",
        deferred: option.deferred || "",
        legal: option.legal || "",
        legalTitle: option.legalRefs?.[0]?.title || "",
        legalHref: option.legalRefs?.[0]?.href || "",
        integrity: option.deltas?.integrity || 0,
        trust: option.deltas?.trust || 0,
        effectiveness: option.deltas?.effectiveness || 0
      }))
    }))
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
      deltas: {
        integrity: Number(option.integrity) || 0,
        trust: Number(option.trust) || 0,
        effectiveness: Number(option.effectiveness) || 0
      }
    }))
  }));
}

function toPayload(form) {
  const shared = {
    code: form.code,
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
      {["integrity", "trust", "effectiveness"].map((key) => (
        <label key={key} className="text-sm text-zinc-300">{key === "integrity" ? "Доброчесність" : key === "trust" ? "Довіра" : "Ефективність"}
          <input type="number" min="-40" max="40" value={option[key]} onChange={(event) => onChange({ [key]: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
        </label>
      ))}
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
  const untitled = (node.options || []).find((option) => (option.title || "").trim().length < 2);
  if (untitled) return node;
  for (const option of node.options || []) {
    const nested = firstGap(option.next);
    if (nested) return nested;
  }
  return null;
}

export default function CaseEditor({ initial, role, pending, error, onSave, onCancel }) {
  const [form, setForm] = useState(() => fromCase(initial));
  const [selectedId, setSelectedId] = useState("");
  const [optionFocus, setOptionFocus] = useState("");
  const [draft, setDraft] = useState(null);
  const [graphNote, setGraphNote] = useState("");
  const [localError, setLocalError] = useState("");
  const selected = form.tree && selectedId ? findNode(form.tree, selectedId) : null;
  const liveTree = form.tree && draft && selected ? replaceNode(form.tree, selected.id, mergeDraft(selected, draft)) : form.tree;
  const payload = useMemo(() => toPayload({ ...form, tree: liveTree }), [form, liveTree]);
  const builtin = initial?.source === "builtin";
  const branching = form.mode === "tree";

  function patch(partial) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function patchStep(index, partial) {
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
    setDraft(nextDraft);
    setGraphNote(note);
    setLocalError("");
  }

  function addOption() {
    if (!draft || !selected) return;
    if (draft.options.length >= 12) {
      setGraphNote("На одному питанні можна додати до 12 варіантів.");
      return;
    }
    changeDraft(
      { ...draft, options: [...draft.options, createLinkedOption(selected.label, draft.options.length)] },
      "Варіант додано. Нова гілка вже на схемі."
    );
  }

  function removeOption(index) {
    if (!draft || draft.options.length <= 2) return;
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

  function endBranch(index) {
    if (!draft?.options[index]?.next) return;
    changeDraft({
      ...draft,
      options: draft.options.map((option, optionIndex) => (
        optionIndex === index ? { ...option, next: null } : option
      ))
    }, "Наступний етап цієї відповіді прибрано.");
  }

  function saveCase(event) {
    event.preventDefault();
    const tree = storedTree();
    if (branching) {
      const gap = firstGap(tree);
      if (gap) {
        setLocalError(`Ситуація ${gap.label} ще не заповнена: потрібен текст ситуації і назва кожного варіанта.`);
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

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">{initial ? "Редагування" : "Новий кейс"}</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">{branching ? "Дерево сценарію" : "Лінійний кейс"}</h1>
        </div>
        <button type="button" onClick={onCancel} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300">Назад</button>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
        {branching
          ? "Новий кейс одразу починається з ситуації 1 і двох відповідей, А та Б. Клік по ситуації або по варіанту відкриває форму: там заповнюється текст, кнопками «+» і «−» змінюється кількість відповідей, а «+ Наступний етап» продовжує обрану гілку."
          : "Цей кейс уже зібраний як послідовність кроків. Нові кейси будуються деревом рішень."}
      </p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={saveCase}>
        <div className="grid gap-4 border border-zinc-800 bg-zinc-900/80 p-5 md:grid-cols-2">
          <label className="text-sm text-zinc-300">Код
            <input value={form.code} onChange={(event) => patch({ code: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" placeholder="EG-12" />
          </label>
          <label className="text-sm text-zinc-300">Тема
            <input required value={form.field} onChange={(event) => patch({ field: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
          </label>
          <label className="text-sm text-zinc-300 md:col-span-2">Назва
            <input required value={form.title} onChange={(event) => patch({ title: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
          </label>
          <label className="text-sm text-zinc-300 md:col-span-2">Короткий опис
            <textarea value={form.summary} onChange={(event) => patch({ summary: event.target.value })} className="mt-2 min-h-24 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
          </label>
          <label className="text-sm text-zinc-300 md:col-span-2">Норми, по одному рядку: назва | посилання
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
          <section className={draft ? "lg:pr-[26rem]" : ""}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-zinc-50">Схема сценарію</h2>
                <p className="mt-1 text-sm text-zinc-400">Клік по ситуації відкриває її текст. Клік по варіанту або стрілці відкриває лише цю відповідь: бали, наслідки і перехід.</p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">{countNodes(liveTree || form.tree)} ситуацій</p>
            </div>
            <ScenarioGraph tree={liveTree || form.tree} selectedId={selectedId} selectedOptionId={optionFocus} onSelectNode={openNode} onSelectOption={openOption} />
          </section>
        ) : null}

        {branching && draft && selected ? (
          <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-zinc-700 bg-zinc-950 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">Ситуація {selected.label}</p>
                <h2 className="mt-1 font-display text-3xl text-zinc-50">{draft.options.some((option) => option.id === optionFocus) ? `Варіант ${optionLetter(draft.options.findIndex((option) => option.id === optionFocus))}` : "Ситуація"}</h2>
              </div>
              <button type="button" onClick={() => { applyDraft(); setSelectedId(""); setOptionFocus(""); setDraft(null); }} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300">Закрити</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {(() => {
                const focusIndex = draft.options.findIndex((option) => option.id === optionFocus);
                const option = focusIndex >= 0 ? draft.options[focusIndex] : null;
                if (!option) {
                  return (
                    <>
                      <label className="block text-sm text-zinc-300">Текст ситуації
                        <textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} className="mt-2 min-h-28 w-full border border-zinc-700 bg-zinc-900 px-3 py-3 text-zinc-100" />
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
                    <button type="button" onClick={() => setOptionFocus("")} className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">До ситуації {selected.label}</button>
                    <div className="mt-4 border border-zinc-800 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">Варіант {optionLetter(focusIndex)}</p>
                        <button type="button" onClick={() => removeOption(focusIndex)} disabled={draft.options.length <= 2} className="border border-zinc-700 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300 disabled:opacity-40">− Видалити</button>
                      </div>
                      <OptionFields option={option} onChange={(partial) => setDraft({
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
                    <p className="mt-4 text-xs leading-5 text-zinc-500">Доброчесність, довіра й ефективність тут — зміна шкали від −40 до +40. Підсумок учасника лишається в межах 0–100.</p>
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
            <label className="mt-3 block text-sm text-zinc-300">Ситуація
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

        <details className="border border-zinc-800 bg-zinc-950 p-4">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.16em] text-olive-300">JSON кейса</summary>
          <pre className="mt-3 overflow-auto text-xs leading-5 text-zinc-400">{JSON.stringify(payload, null, 2)}</pre>
        </details>
        <p className="min-h-5 text-sm text-amber-400">{localError || error}</p>
        <button type="submit" disabled={pending || (branching && !form.tree)} className="border border-olive-600 bg-olive-800 px-5 py-3 font-display text-xl tracking-[0.1em] text-olive-100 disabled:opacity-50">
          {pending ? "Зберігаємо" : "Зберегти JSON"}
        </button>
      </form>
    </section>
  );
}
