import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import TimerReadout from "../components/TimerReadout";
import { send, subscribe } from "../services/socketService";
import { loadRoomResults } from "../services/caseService";

const STORAGE = "eg-host";

function buildJoinUrl(code, lanHost) {
  const protocol = window.location.protocol;
  const port = window.location.port;
  const current = window.location.hostname;
  const loopback = current === "localhost" || current === "127.0.0.1" || current === "::1" || current === "[::1]";
  const hostname = loopback && lanHost ? lanHost : current;
  return `${protocol}//${hostname}${port ? `:${port}` : ""}/?room=${code}`;
}

function copyWithFallback(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.width = "1px";
  area.style.height = "1px";
  area.style.padding = "0";
  area.style.border = "none";
  area.style.outline = "none";
  area.style.boxShadow = "none";
  area.style.background = "transparent";
  area.style.fontSize = "16px";
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, area.value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return copyWithFallback(text);
    }
  }
  return copyWithFallback(text);
}

function readHost() {
  try {
    const raw = sessionStorage.getItem(STORAGE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function GroupFacilitator({ scenarios, token, onBack }) {
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id || "");
  const [groupName, setGroupName] = useState("");
  const [session, setSession] = useState(() => readHost());
  const [room, setRoom] = useState(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lanHost, setLanHost] = useState("");
  const [resultError, setResultError] = useState("");
  const [timerMode, setTimerMode] = useState("none");
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(0);

  useEffect(() => {
    if (!scenarioId && scenarios[0]) setScenarioId(scenarios[0].id);
  }, [scenarios, scenarioId]);

  useEffect(() => {
    let active = true;
    fetch("/api/host")
        .then((response) => response.json())
        .then((payload) => {
          if (active) setLanHost(payload.host || "");
        })
        .catch(() => {
          if (active) setLanHost("");
        });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const offCreated = subscribe("room_created", (payload) => {
      sessionStorage.setItem(STORAGE, JSON.stringify(payload));
      setSession(payload);
      setPending(false);
      setNote("Кімната відкрита.");
    });
    const offState = subscribe("room_state", (payload) => {
      const saved = readHost();
      if (!saved?.code || payload.code !== saved.code) return;
      setRoom(payload);
    });
    const offArchive = subscribe("host_archive", (payload) => {
      const saved = readHost();
      if (!saved?.code || payload.code !== saved.code) return;
      if (!payload) {
        setResultError("Не вдалося отримати дані результатів.");
      }
    });
    const offError = subscribe("room_error", (payload) => {
      console.error("Group room error:", payload);
      setResultError(payload.message || "Не вдалося змінити стан заняття.");
      setPending(false);
      setNote(payload.message || "Кімната не відповіла.");
      if (payload.message && payload.message.includes("не знайдено")) {
        sessionStorage.removeItem(STORAGE);
        setSession(null);
        setRoom(null);
      }
    });
    const saved = readHost();
    if (saved?.code && saved?.token) send("resume_room", saved);
    return () => {
      offCreated();
      offState();
      offArchive();
      offError();
    };
  }, []);

  useEffect(() => {
    const code = session?.code;
    if (!code || !token) return undefined;
    let active = true;
    const refreshFromJson = async () => {
      try {
        const payload = await loadRoomResults(code, token);
        if (!active) return;
        if (!payload?.room) {
          setResultError("");
          return;
        }
        setResultError("");
        setRoom((current) => current ? {
          ...current,
          participantCount: payload.participants?.length || payload.room.participantPeak || current.participantCount,
          finishedCount: payload.room.finishedCount || (payload.participants || []).filter((participant) => participant.status === "completed").length,
          phase: payload.room.phase || current.phase
        } : current);
      } catch (error) {
        if (error.status === 404) {
          setResultError("");
          return;
        }
        console.error("Failed to load group session from JSON:", error);
        setResultError(error.message || "Не вдалося прочитати дані сесії.");
      }
    };
    refreshFromJson();
    const interval = window.setInterval(refreshFromJson, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [session?.code, token]);

  const joinUrl = session ? buildJoinUrl(session.code, lanHost) : "";
  const timerTotalSeconds = timerMode === "none" ? 0 : (timerMinutes * 60) + timerSeconds;

  function createRoom() {
    if (!scenarioId || pending) return;
    setPending(true);
    setNote("Створення кімнати…");
    send("create_room", {
      scenarioId,
      groupName,
      token,
      timerMode,
      totalDurationSeconds: timerMode === "whole_case" ? timerTotalSeconds : 0,
      questionDurationSeconds: timerMode === "per_question" ? timerTotalSeconds : 0
    });
  }

  async function copyLink() {
    if (!joinUrl) return;
    const ok = await writeClipboard(joinUrl);
    setCopied(ok);
    setNote(ok ? "Посилання скопійовано в буфер обміну." : "Не вдалося скопіювати. Виділіть адресу під кодом.");
    if (ok) window.setTimeout(() => setCopied(false), 2500);
  }

  function advance() {
    if (!session) return;
    send("advance", { code: session.code, token: session.token });
  }

  function finishRoom() {
    if (!session || (room?.phase !== "live" && room?.phase !== "lobby")) return;
    setResultError("");
    setPending(true);
    send("finish_room", { code: session.code, token: session.token });
    setRoom((current) => current ? { ...current, phase: "done", endsAt: 0 } : current);
    setNote("Заняття завершено. Підсумки доступні у «Статистиці занять».");
    window.setTimeout(() => {
      setPending(false);
    }, 1500);
  }

  let actionLabel = "Розпочати заняття";
  if (room?.phase === "done") actionLabel = "Заняття завершено";

  return (
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">Фаза викладача</p>
            <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">Групове заняття</h1>
          </div>
          <button type="button" onClick={onBack} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300 hover:border-olive-500">На головну</button>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">Оберіть кейс і назву групи. Якщо назву лишити порожньою, сесія збережеться за датою та часом. Відповіді анонімні: на екрані лише кількість і відсоток кожного варіанта, без імен.</p>
        <div className="mt-5 grid gap-4 border border-zinc-800 bg-zinc-900/70 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid gap-4">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Кейс для кімнати
              <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} className="border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100">
                {scenarios.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} · {item.title}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Назва групи
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} placeholder="Наприклад, група 22" className="border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
            </label>
            <fieldset className="grid gap-3 border border-zinc-700 p-4 text-sm text-zinc-300 sm:grid-cols-[minmax(180px,1fr)_auto] sm:items-end">
              <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">Обмеження часу</legend>
              <label className="flex flex-col gap-2">
                Режим
                <select value={timerMode} onChange={(event) => setTimerMode(event.target.value)} className="border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100">
                  <option value="none">Без обмеження часу</option>
                  <option value="whole_case">На весь кейс</option>
                  <option value="per_question">На кожне питання</option>
                </select>
              </label>
              {timerMode !== "none" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-2 text-xs text-zinc-400">
                      Хвилини
                      <input type="number" min="0" max="180" value={timerMinutes} onChange={(event) => setTimerMinutes(Math.max(0, Math.min(180, Number(event.target.value) || 0)))} className="border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100" />
                    </label>
                    <label className="flex flex-col gap-2 text-xs text-zinc-400">
                      Секунди
                      <input type="number" min="0" max="59" value={timerSeconds} onChange={(event) => setTimerSeconds(Math.max(0, Math.min(59, Number(event.target.value) || 0)))} className="border border-zinc-700 bg-zinc-950 px-3 py-3 text-base text-zinc-100" />
                    </label>
                  </div>
              ) : null}
            </fieldset>
          </div>
          <div className="flex items-stretch lg:min-h-56">
            <button type="button" onClick={createRoom} disabled={pending || !scenarioId || (timerMode !== "none" && timerTotalSeconds < 1)} className="w-full border border-olive-600 bg-olive-800 px-5 py-6 font-display text-2xl tracking-[0.08em] text-olive-100 hover:border-olive-500 hover:bg-olive-700 disabled:opacity-50">
              Створити кімнату
            </button>
          </div>
        </div>
        <p className={`mt-3 min-h-5 font-mono text-[11px] uppercase tracking-[0.14em] ${copied ? "text-olive-300" : "text-amber-500/90"}`} aria-live="polite">{note}</p>
        {resultError ? (
            <p className="mt-2 border border-amber-700 bg-amber-950 px-4 py-3 text-sm text-amber-200" role="alert">
              Помилка: {resultError}
            </p>
        ) : null}
        {session && room ? (
            <div className="mt-2 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex flex-col gap-4">
                <div className="border border-zinc-800 bg-zinc-900/80 p-5">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive-400">Код кімнати</p>
                      <p className="mt-2 font-mono text-4xl tracking-[0.22em] text-zinc-50 sm:text-5xl">{session.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Підключені</p>
                      <p className="font-display text-5xl leading-none text-zinc-50">{room.activeCount ?? room.participantCount}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">Завершили: {room.finishedCount || 0}</p>
                    </div>
                  </div>
                  <p className="mt-4 break-all font-mono text-xs text-zinc-400">{joinUrl}</p>
                  {room.phase === "live" && room.endsAt ? <div className="mt-4"><TimerReadout endsAt={room.endsAt} scope={room.timerMode === "per_question" ? "step" : "whole_case"} /></div> : null}
                  {room.phase === "live" && room.stepClockPaused ? <p className="mt-4 text-sm leading-6 text-olive-200">Час першого завдання вийшов. Слухачі з розгалуженням ідуть далі власними гілками, кожна зі своїм відліком.</p> : null}
                  {room.phase === "done" && room.timedOut ? <p className="mt-4 text-sm leading-6 text-amber-200">Час вийшов. Заняття закрито, слухачі бачать власний розбір відповідей.</p> : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={copyLink} className={`border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] hover:border-olive-500 ${copied ? "border-olive-500 bg-olive-950 text-olive-200" : "border-zinc-600 text-zinc-200"}`}>{copied ? "Скопійовано" : "Копіювати посилання"}</button>
                    {room.phase === "lobby" ? (
                        <>
                          <button type="button" onClick={advance} className="border border-olive-600 bg-olive-800 px-4 py-3 font-display text-xl tracking-[0.08em] text-olive-100 hover:border-olive-500 hover:bg-olive-700">
                            {actionLabel}
                          </button>
                          <button type="button" onClick={finishRoom} disabled={pending} className="border border-amber-700 bg-amber-950 px-4 py-3 font-display text-xl tracking-[0.08em] text-amber-100 hover:border-amber-500 disabled:opacity-50">
                            Завершити заняття
                          </button>
                        </>
                    ) : null}
                    {room.phase === "live" ? (
                        <button type="button" onClick={finishRoom} disabled={pending} className="border border-amber-700 bg-amber-950 px-4 py-3 font-display text-xl tracking-[0.08em] text-amber-100 hover:border-amber-500 disabled:opacity-50">
                          Завершити заняття
                        </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <aside className="border border-zinc-800 bg-zinc-900 p-4 text-center xl:sticky xl:top-4 xl:self-start">
                <div className="inline-block rounded bg-white p-4">
                  <QRCodeSVG value={joinUrl} size={220} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin />
                </div>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">QR входу в кімнату</p>
              </aside>
            </div>
        ) : null}
      </section>
  );
}