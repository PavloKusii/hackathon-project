import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { send, subscribe } from "../services/socketService";

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

export default function GroupFacilitator({ scenarios, onBack }) {
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id || "");
  const [session, setSession] = useState(() => readHost());
  const [room, setRoom] = useState(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lanHost, setLanHost] = useState("");

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
    const offError = subscribe("room_error", (payload) => {
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
      offError();
    };
  }, []);

  const activeScenario = scenarios.find((item) => item.id === (session?.scenarioId || scenarioId)) || null;
  const step = activeScenario && room && (room.phase === "live" || room.phase === "done") ? activeScenario.steps[room.stepIndex] : null;
  const joinUrl = session ? buildJoinUrl(session.code, lanHost) : "";
  const totalVotes = (room?.tallies || []).reduce((sum, item) => sum + item.count, 0);

  function createRoom() {
    if (!scenarioId || pending) return;
    setPending(true);
    setNote("Створення кімнати…");
    send("create_room", { scenarioId });
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

  let actionLabel = "Відкрити перший крок";
  if (room?.phase === "live") {
    actionLabel = room.stepIndex >= (room.stepCount || 1) - 1 ? "Завершити заняття" : "Наступний крок";
  }
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
      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">Оберіть кейс і відкрийте кімнату. QR веде на цю адресу з кодом кімнати. Телефон слухача одразу потрапляє в анонімний вхід, а діаграма оновлюється з кожним голосом.</p>
      <div className="mt-5 flex flex-col gap-3 border border-zinc-800 bg-zinc-900/70 p-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2 text-sm text-zinc-300">
          Кейс для кімнати
          <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} className="border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100">
            {scenarios.map((item) => (
              <option key={item.id} value={item.id}>{item.code} · {item.title}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={createRoom} disabled={pending || !scenarioId} className="border border-olive-600 bg-olive-800 px-5 py-3 font-display text-xl tracking-[0.1em] text-olive-100 hover:border-olive-500 hover:bg-olive-700 disabled:opacity-50">
          Створити кімнату
        </button>
      </div>
      <p className={`mt-3 min-h-5 font-mono text-[11px] uppercase tracking-[0.14em] ${copied ? "text-olive-300" : "text-amber-500/90"}`} aria-live="polite">{note}</p>
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
                  <p className="font-display text-5xl leading-none text-zinc-50">{room.participantCount}</p>
                </div>
              </div>
              <p className="mt-4 break-all font-mono text-xs text-zinc-400">{joinUrl}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={copyLink} className={`border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] hover:border-olive-500 ${copied ? "border-olive-500 bg-olive-950 text-olive-200" : "border-zinc-600 text-zinc-200"}`}>{copied ? "Скопійовано" : "Копіювати посилання"}</button>
                <button type="button" onClick={advance} disabled={room.phase === "done"} className="border border-olive-600 bg-olive-800 px-4 py-3 font-display text-xl tracking-[0.08em] text-olive-100 hover:border-olive-500 hover:bg-olive-700 disabled:opacity-50">
                  {actionLabel}
                </button>
              </div>
            </div>
            <article className="border border-zinc-800 bg-zinc-950/80 p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                {room.phase === "lobby" ? "Очікування" : room.phase === "done" ? "Заняття завершено" : `Крок ${String(room.stepIndex + 1).padStart(2, "0")} / ${String(room.stepCount).padStart(2, "0")}`}
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-wide text-zinc-50">{activeScenario?.title}</h2>
              {step ? <p className="mt-3 text-sm leading-7 text-zinc-300">{step.prompt}</p> : <p className="mt-3 text-sm leading-7 text-zinc-400">Відкрийте крок, коли аудиторія в кімнаті. До цього слухачі бачать екран очікування.</p>}
            </article>
            <div className="flex flex-col gap-3">
              {(step?.options || []).map((option) => {
                const tally = (room.tallies || []).find((item) => item.id === option.id);
                const count = tally?.count || 0;
                const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                return (
                  <div key={option.id} className="border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-zinc-200">{option.title}</p>
                      <p className="font-mono text-sm text-zinc-300">{pct}%</p>
                    </div>
                    <div className="mt-3 h-2 bg-zinc-800">
                      <div className="bar-fill h-2 bg-olive-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Відповідей: {count}</p>
                  </div>
                );
              })}
              {room.phase === "lobby" ? <p className="text-sm text-zinc-500">Діаграма з’явиться разом із першим кроком.</p> : null}
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
