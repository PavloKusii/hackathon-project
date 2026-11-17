import { useMemo, useState } from "react";

function blankOption(id) {
  return {
    id,
    title: "",
    text: "",
    badges: "",
    analysis: "",
    deferred: "",
    legal: "",
    legalTitle: "",
    legalHref: "",
    integrity: 0,
    trust: 0,
    effectiveness: 0
  };
}

function blankStep() {
  return { id: "", prompt: "", options: [blankOption("a"), blankOption("b")] };
}

function fromCase(item) {
  if (!item) {
    return {
      code: "",
      title: "",
      field: "",
      summary: "",
      visibility: "local",
      status: "local",
      normsText: "",
      steps: [blankStep()]
    };
  }
  return {
    code: item.code || "",
    title: item.title || "",
    field: item.field || "",
    summary: item.summary || "",
    visibility: item.visibility === "public" || item.status === "published" || item.status === "pending" ? "public" : "local",
    status: item.status || "local",
    normsText: (item.norms || []).map((norm) => (norm.href ? `${norm.title} | ${norm.href}` : norm.title)).join("\n"),
    steps: (item.steps || []).map((step) => ({
      id: step.id || "",
      prompt: step.prompt || "",
      options: (step.options || []).map((option) => ({
        id: option.id,
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

function toPayload(form) {
  const norms = form.normsText.split("\n").map((line) => {
    const [title, href] = line.split("|").map((part) => part.trim());
    return title ? { title, href: href || "" } : null;
  }).filter(Boolean);
  return {
    code: form.code,
    title: form.title,
    field: form.field,
    summary: form.summary,
    visibility: form.visibility,
    status: form.status,
    norms,
    steps: form.steps.map((step) => ({
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
    }))
  };
}

export default function CaseEditor({ initial, role, pending, error, onSave, onCancel }) {
  const [form, setForm] = useState(() => fromCase(initial));
  const payload = useMemo(() => toPayload(form), [form]);
  const builtin = initial?.source === "builtin";

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

  function addStep() {
    if (form.steps.length >= 8) return;
    patch({ steps: [...form.steps, blankStep()] });
  }

  function addOption(stepIndex) {
    const step = form.steps[stepIndex];
    if (step.options.length >= 4) return;
    const id = String.fromCharCode(97 + step.options.length);
    patchStep(stepIndex, { options: [...step.options, blankOption(id)] });
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">{initial ? "Редагування" : "Новий кейс"}</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">{initial ? "Змінити сценарій" : "Форма кейса"}</h1>
        </div>
        <button type="button" onClick={onCancel} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300">Назад</button>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
        Кейс зберігається як JSON. Локальний лишається у вашому обліковому записі для індивідуального чи групового проходження. Публічний надходить супер-адміну і з’являється для всіх лише після рішення про доступ.
      </p>
      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(payload);
        }}
      >
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
        {form.steps.map((step, stepIndex) => (
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
                <div key={`${stepIndex}-${option.id}-${optionIndex}`} className="border border-zinc-800 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-400">Варіант {optionIndex + 1}</p>
                    {step.options.length > 2 ? (
                      <button type="button" onClick={() => patchStep(stepIndex, { options: step.options.filter((_, index) => index !== optionIndex) })} className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Прибрати</button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-zinc-300 md:col-span-2">Назва
                      <input required value={option.title} onChange={(event) => patchOption(stepIndex, optionIndex, { title: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
                    </label>
                    <label className="text-sm text-zinc-300 md:col-span-2">Текст дії
                      <input value={option.text} onChange={(event) => patchOption(stepIndex, optionIndex, { text: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
                    </label>
                    <label className="text-sm text-zinc-300 md:col-span-2">Пояснення для учасника
                      <textarea value={option.analysis} onChange={(event) => patchOption(stepIndex, optionIndex, { analysis: event.target.value })} className="mt-2 min-h-20 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
                    </label>
                    <label className="text-sm text-zinc-300">Відкладені наслідки
                      <textarea value={option.deferred} onChange={(event) => patchOption(stepIndex, optionIndex, { deferred: event.target.value })} className="mt-2 min-h-20 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
                    </label>
                    <label className="text-sm text-zinc-300">Правова опора
                      <textarea value={option.legal} onChange={(event) => patchOption(stepIndex, optionIndex, { legal: event.target.value })} className="mt-2 min-h-20 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
                    </label>
                    {["integrity", "trust", "effectiveness"].map((key) => (
                      <label key={key} className="text-sm text-zinc-300">{key === "integrity" ? "Доброчесність" : key === "trust" ? "Довіра" : "Ефективність"}
                        <input type="number" min="-40" max="40" value={option[key]} onChange={(event) => patchOption(stepIndex, optionIndex, { [key]: event.target.value })} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {step.options.length < 4 ? (
              <button type="button" onClick={() => addOption(stepIndex)} className="mt-3 border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300">Додати варіант</button>
            ) : null}
          </article>
        ))}
        {form.steps.length < 8 ? (
          <button type="button" onClick={addStep} className="border border-zinc-700 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-300">Додати крок</button>
        ) : null}
        <details className="border border-zinc-800 bg-zinc-950 p-4">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.16em] text-olive-300">JSON кейса</summary>
          <pre className="mt-3 overflow-auto text-xs leading-5 text-zinc-400">{JSON.stringify(payload, null, 2)}</pre>
        </details>
        <p className="min-h-5 text-sm text-amber-400">{error}</p>
        <button type="submit" disabled={pending} className="border border-olive-600 bg-olive-800 px-5 py-3 font-display text-xl tracking-[0.1em] text-olive-100 disabled:opacity-50">
          {pending ? "Зберігаємо" : "Зберегти JSON"}
        </button>
      </form>
    </section>
  );
}
