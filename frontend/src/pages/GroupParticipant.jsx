import { useEffect, useRef, useState } from "react";
import TimerReadout from "../components/TimerReadout";
import ActionCard from "../components/ActionCard";
import FeedbackPanel from "../components/FeedbackPanel";
import MetricsGauges from "../components/MetricsGauges";
import { onConnect, onConnectError, send, subscribe } from "../services/socketService";
import { clampScore, freshScores } from "../scores";
import { findNode } from "../scenarioTree";

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

export default function GroupParticipant({ scenarios, initialCode, token, user, onSave, onAuthenticate, onBack }) {
  const entry = (initialCode || codeFromLocation() || "").trim().toUpperCase();
  const activeRef = useRef("");
  const [draft, setDraft] = useState(entry);
  const [activeCode, setActiveCode] = useState(entry);
  const [room, setRoom] = useState(null);
  const [choice, setChoice] = useState({ stepIndex: -1, nodeId: "", optionId: "" });
  const [branchId, setBranchId] = useState("");
  const [note, setNote] = useState("");
  const [joining, setJoining] = useState(false);
  const [pass, setPass] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [scores, setScores] = useState(freshScores);
  const [history, setHistory] = useState([]);
  const [selfDone, setSelfDone] = useState(false);
  const [localEndsAt, setLocalEndsAt] = useState(0);
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
      setChoice((current) => {
        if (current.nodeId) return current;
        return {
          stepIndex: Number(payload.stepIndex),
          nodeId: "",
          optionId: payload.optionId || ""
        };
      });
    });
    const joinCurrent = () => {
      const code = activeRef.current;
      if (!code || (pass !== "guest" && pass !== "account")) return;
      setJoining(true);
      send("join_room", { code, guestId: guestIdFor(code) });
    };
    const offConnect = onConnect(joinCurrent);
    const offFail = onConnectError(() => {
      if (!activeRef.current) return;
      setNote("Зв’язок із заняттям ще встановлюється. Залишайтесь на цій сторінці.");
    });
    if (pass === "guest" || pass === "account") joinCurrent();
    return () => {
      offState();
      offError();
      offScenario();
      offVote();
      offConnect();
      offFail();
    };
  }, [pass]);

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
    setPass("");
    setLoginOpen(false);
    setNote("");
    setJoining(false);
    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function enterAs(mode) {
    if (!activeCode && !draft.trim()) {
      setNote("Введіть код кімнати.");
      return;
    }
    const code = (activeCode || draft).trim().toUpperCase();
    activeRef.current = code;
    setActiveCode(code);
    setPass(mode);
    setJoining(true);
    setNote("");
  }

  async function loginAndEnter(event) {
    event.preventDefault();
    if (!onAuthenticate) return;
    setLoginPending(true);
    setNote("");
    try {
      await onAuthenticate({ email: loginEmail, password: loginPassword });
      enterAs("account");
    } catch (error) {
      setNote(error.message || "Вхід не вдався.");
    } finally {
      setLoginPending(false);
    }
  }

  const scenario = scenarios.find((item) => item.id === room?.scenarioId) || (bundle?.id === room?.scenarioId ? bundle : null);
  const branching = Boolean(scenario?.tree);
  const liveStep = scenario && room && room.phase === "live"
    ? (branching ? findNode(scenario.tree, branchId || scenario.tree.id) : scenario.steps?.[room.stepIndex])
    : null;
  const voted = branching
    ? Boolean(liveStep && choice.nodeId === liveStep.id && choice.optionId)
    : Boolean(room && choice.stepIndex === room.stepIndex && choice.optionId);
  const showCode = !activeCode && !room && !joining;
  const showChoice = Boolean(activeCode) && !pass && !room && !joining;

  const picked = voted && liveStep ? (liveStep.options || []).find((item) => item.id === choice.optionId) : null;
  const pickedRef = useRef(null);
  pickedRef.current = picked;
  const stepMode = (scenario?.timeMode === "step" || room?.timerScope === "step") && Number(scenario?.timeLimitSeconds) > 0;
  const onPersonal = Boolean(stepMode && branching && liveStep && scenario?.tree && liveStep.id !== scenario.tree.id && room?.phase === "live" && !selfDone);
  const sharedEnds = Number(room?.endsAt) || 0;
  const endsAt = onPersonal ? localEndsAt : sharedEnds;
  const timerScope = onPersonal || room?.timerScope === "step" ? "step" : "case";
  const finished = room?.phase === "done" || selfDone;

  useEffect(() => {
    if (!onPersonal) {
      setLocalEndsAt(0);
      return undefined;
    }
    const ends = Date.now() + Number(scenario.timeLimitSeconds) * 1000;
    setLocalEndsAt(ends);
    const id = window.setTimeout(() => {
      const latest = pickedRef.current;
      if (latest?.next) {
        setBranchId(latest.next.id);
        setChoice({ stepIndex: room.stepIndex, nodeId: "", optionId: "" });
        return;
      }
      setSelfDone(true);
    }, Math.max(0, ends - Date.now()));
    return () => window.clearTimeout(id);
  }, [onPersonal, liveStep?.id, scenario?.timeLimitSeconds, room?.stepIndex]);

  useEffect(() => {
    if (room?.phase !== "live" || selfDone || !sharedEnds || onPersonal) return undefined;
    const wait = Math.max(0, sharedEnds - Date.now());
    const id = window.setTimeout(() => {
      if (room.timerScope === "step" && !branching && room.stepIndex < (room.stepCount || 1) - 1) return;
      if (room.timerScope === "step" && branching) return;
      setSelfDone(true);
    }, wait);
    return () => window.clearTimeout(id);
  }, [room?.phase, room?.timerScope, room?.stepIndex, room?.stepCount, selfDone, sharedEnds, onPersonal, branching]);

  useEffect(() => {
    if (!room?.stepClockPaused || room.phase !== "live" || selfDone || !branching || !liveStep || !scenario?.tree) return;
    if (liveStep.id !== scenario.tree.id) return;
    if (picked?.next) {
      setBranchId(picked.next.id);
      setChoice({ stepIndex: room.stepIndex, nodeId: "", optionId: "" });
      return;
    }
    setSelfDone(true);
  }, [room?.stepClockPaused, room?.phase, room?.stepIndex, selfDone, branching, liveStep, scenario?.tree, picked]);

  useEffect(() => {
    if (!voted || !picked || !room) return;
    const key = `${room.code}:${liveStep?.id || room.stepIndex}:${choice.optionId}`;
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
    if (pass !== "account" || !finished || !token || !history.length || savedRef.current || !onSave) return;
    savedRef.current = true;
    onSave({
      scenarioId: room.scenarioId,
      mode: "group",
      choices: history.map((entry) => ({ stepId: entry.stepId, optionId: entry.option.id }))
    });
  }, [pass, finished, room?.phase, room?.scenarioId, token, history, onSave]);

  function vote(optionId) {
    if (!room || room.phase !== "live" || voted || !liveStep) return;
    setChoice({ stepIndex: room.stepIndex, nodeId: liveStep.id, optionId });
    if (!branching || liveStep.id === scenario.tree.id) {
      send("submit_vote", { code: room.code, guestId: guestIdFor(room.code), optionId });
    }
  }

  function continueBranch() {
    if (!picked?.next) return;
    setBranchId(picked.next.id);
    setChoice({ stepIndex: room.stepIndex, nodeId: "", optionId: "" });
  }

  return (
    <section className="min-h-[70vh]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">Слухач</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">Вхід у кімнату</h1>
        </div>
        <button type="button" onClick={onBack} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300 hover:border-olive-500">На головну</button>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">Код із екрана організатора або QR відкриває кімнату. Далі оберіть гостя або вхід в обліковий запис. На телефоні обидві кнопки на всю ширину.</p>
      {showCode ? (
        <form onSubmit={submit} className="mt-6 max-w-md border border-zinc-700 bg-zinc-900 p-5">
          <label htmlFor="room-code" className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">Код кімнати</label>
          <input id="room-code" value={draft} onChange={(event) => setDraft(event.target.value.toUpperCase())} maxLength={8} autoComplete="off" className="mt-2 w-full border border-zinc-600 bg-zinc-950 px-3 py-4 font-mono text-3xl uppercase tracking-[0.28em] text-zinc-50" />
          <button type="submit" className="mt-4 w-full border border-olive-600 bg-olive-800 px-5 py-4 font-display text-xl tracking-[0.1em] text-olive-100">Далі</button>
        </form>
      ) : null}
      {showChoice ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => enterAs("guest")} className="border border-zinc-700 bg-zinc-900 p-5 text-left hover:border-olive-500">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Кімната {activeCode}</p>
            <p className="mt-2 font-display text-3xl text-zinc-50">Гість</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Анонімно. Розбір лишається на екрані і не прив’язується до профілю.</p>
          </button>
          <button type="button" onClick={() => (token ? enterAs("account") : setLoginOpen(true))} className="border border-olive-700 bg-olive-950 p-5 text-left hover:border-olive-500">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-300">Кімната {activeCode}</p>
            <p className="mt-2 font-display text-3xl text-zinc-50">{token ? "Мій обліковий запис" : "Увійти"}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{token ? `Результат збережеться для ${user?.login || user?.email}.` : "Логін і пароль. Розбір запишеться у ваш кабінет."}</p>
          </button>
          {loginOpen && !token ? (
            <form onSubmit={loginAndEnter} className="flex flex-col gap-3 border border-zinc-800 bg-zinc-950 p-5 sm:col-span-2">
              <label className="text-sm text-zinc-300">Пошта або логін
                <input required value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="mt-2 w-full border border-zinc-700 bg-zinc-900 px-3 py-3 text-base text-zinc-100" />
              </label>
              <label className="text-sm text-zinc-300">Пароль
                <input required type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="mt-2 w-full border border-zinc-700 bg-zinc-900 px-3 py-3 text-base text-zinc-100" />
              </label>
              <button type="submit" disabled={loginPending} className="border border-olive-600 bg-olive-800 px-5 py-4 font-display text-xl text-olive-100 disabled:opacity-50">{loginPending ? "Входимо" : "Увійти і приєднатися"}</button>
            </form>
          ) : null}
        </div>
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
          {finished ? (
            <article className="mt-4 border border-zinc-700 bg-zinc-900 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive-300">Ваш розбір</p>
              <h2 className="mt-2 font-display text-3xl tracking-wide text-zinc-50">{room.timedOut || selfDone ? "Час вийшов" : "Заняття завершено"}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                {room.timedOut || selfDone ? "Проходження закрито автоматично. Нижче ваші відповіді, пояснення і місця, де вибір був слабшим за доброчесністю." : pass === "account" ? "Особисті відповіді збережено на обліковому записі. Організатор бачить лише загальні відсотки." : "Ви увійшли як гість. Цей розбір лишається на екрані і ніде не зберігається."}
              </p>
              {history.length === 0 ? <p className="mt-3 text-sm leading-6 text-zinc-400">Відповідей ще не було, тож шкали лишилися на старті.</p> : null}
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
          {room.phase === "live" && !finished && !liveStep ? (
            <article className="mt-4 border border-olive-700 bg-zinc-900 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive-300">Крок відкрито</p>
              <h2 className="mt-2 font-display text-3xl tracking-wide text-zinc-50">Ситуація з’являється</h2>
              <p className="mt-3 text-base leading-7 text-zinc-200">Текст дилеми вже на шляху. Залишайтесь на цій сторінці.</p>
            </article>
          ) : null}
          {liveStep && !finished ? (
            <div className="mt-4">
              {endsAt ? <div className="mb-4"><TimerReadout endsAt={endsAt} scope={timerScope} /></div> : null}
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                {scenario.code} · {branching ? `гілка ${liveStep.label || ""}` : `крок ${String(room.stepIndex + 1).padStart(2, "0")} / ${String(room.stepCount || scenario.steps.length).padStart(2, "0")}`}
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
                  <FeedbackPanel option={picked} last={!picked.next} onNext={picked.next ? continueBranch : undefined} />
                  {!picked.next ? <p className="mt-3 text-sm leading-6 text-zinc-400">Вашу гілку пройдено. Загальний підсумок відкриється, коли організатор завершить заняття.</p> : null}
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
