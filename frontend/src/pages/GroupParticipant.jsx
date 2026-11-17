import { useEffect, useRef, useState } from "react";
import ActionCard from "../components/ActionCard";
import FeedbackPanel from "../components/FeedbackPanel";
import MetricsGauges from "../components/MetricsGauges";
import { onConnect, onConnectError, send, subscribe } from "../services/socketService";
import { clampScore, freshScores } from "../scores";

function randomGuestId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let body = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  } else {
    body = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
  return `g-${body}`;
}

function guestIdFor(code) {
  const key = `eg-guest:${code}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const id = randomGuestId();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return randomGuestId();
  }
}

function codeFromLocation() {
  return (new URLSearchParams(window.location.search).get("room") || "").trim().toUpperCase();
}

export default function GroupParticipant({ scenarios, initialCode, token, onSave, onBack }) {
  const entry = (initialCode || codeFromLocation() || "").trim().toUpperCase();
  const activeRef = useRef(entry);
  const [draft, setDraft] = useState(entry);
  const [activeCode, setActiveCode] = useState(entry);
  const [room, setRoom] = useState(null);
  const [choice, setChoice] = useState({ stepIndex: -1, optionId: "" });
  const [note, setNote] = useState("");
  const [joining, setJoining] = useState(Boolean(entry));
  const [scores, setScores] = useState(freshScores);
  const [history, setHistory] = useState([]);
  const [bundle, setBundle] = useState(null);
  const appliedRef = useRef(new Set());
  const savedRef = useRef(false);

  useEffect(() => {
    const offState = subscribe("room_state", (payload) => {
      if (!activeRef.current || payload.code !== activeRef.current) return;
      setRoom(payload);
      setJoining(false);
      setNote("");
    });
    const offError = subscribe("room_error", (payload) => {
      if (!activeRef.current) return;
      setJoining(false);
      setNote(payload.message || "Вхід не вдався.");
    });
    const offScenario = subscribe("scenario_payload", (payload) => {
      if (payload?.id) setBundle(payload);
    });
    const offVote = subscribe("your_vote", (payload) => {
      if (!payload) return;
      setChoice({
        stepIndex: Number(payload.stepIndex),
        optionId: payload.optionId || ""
      });
    });
    const joinCurrent = () => {
      const code = activeRef.current;
      if (!code) return;
      setJoining(true);
      send("join_room", { code, guestId: guestIdFor(code) });
    };
    const offConnect = onConnect(joinCurrent);
    const offFail = onConnectError(() => {
      if (!activeRef.current) return;
      setNote("Зв’язок із заняттям ще встановлюється. Залишайтесь на цій сторінці.");
    });
    if (entry) {
      activeRef.current = entry;
      setActiveCode(entry);
      setDraft(entry);
      joinCurrent();
    }
    return () => {
      offState();
      offError();
      offScenario();
      offVote();
      offConnect();
      offFail();
    };
  }, [entry]);

  function submit(event) {
    event.preventDefault();
    const code = draft.trim().toUpperCase();
    if (!code) {
      setNote("Введіть код кімнати.");
      return;
    }
    activeRef.current = code;
    setActiveCode(code);
    setRoom(null);
    setNote("");
    setJoining(true);
    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    send("join_room", { code, guestId: guestIdFor(code) });
  }

  const scenario = scenarios.find((item) => item.id === room?.scenarioId) || (bundle?.id === room?.scenarioId ? bundle : null);
  const liveStep = scenario && room && room.phase === "live" ? scenario.steps?.[room.stepIndex] : null;
  const voted = Boolean(room && choice.stepIndex === room.stepIndex && choice.optionId);
  const showForm = !room && !joining;

  const picked = voted && liveStep ? (liveStep.options || []).find((item) => item.id === choice.optionId) : null;

  useEffect(() => {
    if (!voted || !picked || !room) return;
    const key = `${room.code}:${room.stepIndex}:${choice.optionId}`;
    if (appliedRef.current.has(key)) return;
    appliedRef.current.add(key);
    setScores((prev) => {
      const next = { ...prev };
      ["integrity", "trust", "effectiveness"].forEach((metric) => {
        next[metric] = clampScore((next[metric] || 0) + Number(picked.deltas?.[metric] || 0));
      });
      return next;
    });
    const best = Math.max(...(liveStep.options || []).map((item) => Number(item.deltas?.integrity || 0)));
    setHistory((current) => {
      if (current.some((entry) => entry.stepId === liveStep.id)) return current;
      return [...current, {
        stepId: liveStep.id,
        prompt: liveStep.prompt,
        option: picked,
        mistake: Number(picked.deltas?.integrity || 0) < best
      }];
    });
  }, [voted, picked, room, choice.optionId, liveStep]);

  useEffect(() => {
    if (!voted) return;
    document.getElementById("feedback")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [voted, room?.stepIndex, choice.optionId]);

  useEffect(() => {
    if (room?.phase !== "done" || !token || !history.length || savedRef.current || !onSave) return;
    savedRef.current = true;
    onSave({
      scenarioId: room.scenarioId,
      mode: "group",
      choices: history.map((entry) => ({ stepId: entry.stepId, optionId: entry.option.id }))
    });
  }, [room?.phase, room?.scenarioId, token, history, onSave]);

  function vote(optionId) {
    if (!room || room.phase !== "live" || voted) return;
    setChoice({ stepIndex: room.stepIndex, optionId });
    send("submit_vote", { code: room.code, guestId: guestIdFor(room.code), optionId });
  }

  return (
    <section className="min-h-[70vh]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">Слухач</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">Анонімний вхід</h1>
        </div>
        <button type="button" onClick={onBack} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300 hover:border-olive-500">На головну</button>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">Ім’я не запитується. Достатньо коду кімнати з екрана викладача.</p>
      {showForm ? (
        <form onSubmit={submit} className="mt-6 max-w-md border border-zinc-700 bg-zinc-900 p-5">
          <label htmlFor="room-code" className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">Код кімнати</label>
          <input id="room-code" value={draft} onChange={(event) => setDraft(event.target.value.toUpperCase())} maxLength={6} autoComplete="off" className="mt-2 w-full border border-zinc-600 bg-zinc-950 px-3 py-3 font-mono text-2xl uppercase tracking-[0.28em] text-zinc-50" />
          <button type="submit" className="mt-4 border border-olive-600 bg-olive-800 px-5 py-3 font-display text-xl tracking-[0.1em] text-olive-100 hover:border-olive-500 hover:bg-olive-700">Увійти анонімно</button>
        </form>
      ) : null}
      {joining && !room ? (
        <article className="mt-6 border border-olive-700 bg-olive-950 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive-300">З’єднання</p>
          <h2 className="mt-2 font-display text-3xl tracking-wide text-zinc-50">Вхід у кімнату {activeCode}</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-200">Підключаємось до заняття. Зачекайте на екрані.</p>
        </article>
      ) : null}
      {room ? (
        <div className="mt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-olive-400">Кімната {room.code || activeCode}</p>
          {room.phase === "lobby" ? (
            <article className="mt-4 border border-olive-700 bg-zinc-900 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive-300">Очікування старту</p>
              <h2 className="mt-2 font-display text-3xl tracking-wide text-zinc-50">Ви в кімнаті</h2>
              <p className="mt-3 text-base leading-7 text-zinc-200">Викладач ще не відкрив перший крок. Ситуація і варіанти з’являться тут одразу після старту.</p>
            </article>
          ) : null}
          {room.phase === "done" ? (
            <article className="mt-4 border border-zinc-700 bg-zinc-900 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive-300">Ваш розбір</p>
              <h2 className="mt-2 font-display text-3xl tracking-wide text-zinc-50">Заняття завершено</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                {token ? "Особисті відповіді збережено на обліковому записі. Організатор бачить лише загальні відсотки." : "Ви увійшли анонімно. Цей розбір лишається на екрані і ніде не зберігається."}
              </p>
              <div className="mt-4"><MetricsGauges scores={scores} /></div>
              <div className="mt-4 flex flex-col gap-3">
                {history.map((entry, index) => (
                  <div key={`${entry.stepId}-${index}`} className="border border-zinc-800 bg-zinc-950 p-4">
                    <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${entry.mistake ? "text-amber-400" : "text-olive-400"}`}>
                      Крок {String(index + 1).padStart(2, "0")} · {entry.mistake ? "слабше за доброчесністю" : "сильний варіант"}
                    </p>
                    <h3 className="mt-2 font-display text-2xl text-zinc-50">{entry.option.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{entry.option.analysis}</p>
                    {entry.option.legal ? <p className="mt-2 text-sm leading-6 text-zinc-400">{entry.option.legal}</p> : null}
                  </div>
                ))}
              </div>
            </article>
          ) : null}
          {room.phase === "live" && !liveStep ? (
            <article className="mt-4 border border-olive-700 bg-zinc-900 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive-300">Крок відкрито</p>
              <h2 className="mt-2 font-display text-3xl tracking-wide text-zinc-50">Ситуація з’являється</h2>
              <p className="mt-3 text-base leading-7 text-zinc-200">Текст дилеми вже на шляху. Залишайтесь на цій сторінці.</p>
            </article>
          ) : null}
          {liveStep ? (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                {scenario.code} · крок {String(room.stepIndex + 1).padStart(2, "0")} / {String(room.stepCount || scenario.steps.length).padStart(2, "0")}
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-wide text-zinc-50">{scenario.title}</h2>
              <article className="mt-4 border border-zinc-700 bg-zinc-950 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">Ситуація</p>
                <p className="mt-3 text-base leading-7 text-zinc-100">{liveStep.prompt}</p>
              </article>
              <div className="mt-4 flex flex-col gap-3">
                {(liveStep.options || []).map((option, index) => (
                  <ActionCard
                    key={option.id}
                    index={index}
                    option={option}
                    selected={voted && choice.optionId === option.id}
                    collapsed={voted && choice.optionId !== option.id}
                    onSelect={vote}
                  />
                ))}
              </div>
              {picked ? (
                <div className="mt-4 border border-zinc-800 bg-zinc-900/80 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Вплив вибору</p>
                  <div className="mt-4">
                    <MetricsGauges scores={scores} />
                  </div>
                  <FeedbackPanel option={picked} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="mt-4 min-h-5 text-sm text-amber-300" aria-live="polite">{note}</p>
    </section>
  );
}
