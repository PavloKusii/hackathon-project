import { Component, useCallback, useEffect, useRef, useState } from "react";
import { fetchScenarios } from "./services/scenarioService";
import { authRequest, clearSession, readSession, saveSession } from "./services/authService";
import { createCase, deleteCase, loadAttempts, loadManage, loadModeration, loadSessions, moderateCase, saveAttempt, updateCase } from "./services/caseService";
import { freshScores } from "./scores";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import CaseSelector from "./pages/CaseSelector";
import Simulation from "./pages/Simulation";
import Debriefing from "./pages/Debriefing";
import Library from "./pages/Library";
import GroupFacilitator from "./pages/GroupFacilitator";
import GroupParticipant from "./pages/GroupParticipant";
import AuthScreen from "./pages/AuthScreen";
import Account from "./pages/Account";
import UserStats from "./pages/UserStats";
import Results from "./pages/Results";
import CaseEditor from "./pages/CaseEditor";
import Moderation from "./pages/Moderation";
import OrganizerStats from "./pages/OrganizerStats";

export { freshScores };
export const BASE_SCORE = 100;

function roomFromLocation() {
  return (new URLSearchParams(window.location.search).get("room") || "").trim();
}

function initialScreen() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("room")) return "participant";
  if (params.get("staff") === "1") return "staff";
  return "dashboard";
}

class RoomBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="border border-zinc-800 bg-zinc-900 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-olive-400">Слухач</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50">Кімната не відкрилась</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300">Оновіть сторінку за тим самим посиланням. Код кімнати лишається в адресі.</p>
        </section>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [screen, setScreen] = useState(initialScreen);
  const [entryCode] = useState(() => roomFromLocation());
  const [session, setSession] = useState(() => readSession());
  const [scenarios, setScenarios] = useState([]);
  const [managed, setManaged] = useState([]);
  const [queue, setQueue] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [scenarioId, setScenarioId] = useState("");
  const [run, setRun] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");
  const [formPending, setFormPending] = useState(false);
  const [moderationNote, setModerationNote] = useState("");
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [stored, setStored] = useState(false);
  const soloKey = useRef("");
  const role = session?.user?.role || "guest";
  const organizer = role === "organizer";
  const admin = role === "superadmin";

  const refreshPrivate = useCallback(async (nextSession) => {
    const token = nextSession?.token;
    const nextRole = nextSession?.user?.role;
    if (!token) {
      setManaged([]);
      setQueue([]);
      setAttempts([]);
      setSessions([]);
      return;
    }
    try {
      const attemptPayload = await loadAttempts(token);
      setAttempts(attemptPayload.attempts || []);
    } catch {
      setAttempts([]);
    }
    if (nextRole === "organizer" || nextRole === "superadmin") {
      try {
        const managedPayload = await loadManage(token);
        setManaged(managedPayload.cases || []);
      } catch {
        setManaged([]);
      }
      try {
        const sessionPayload = await loadSessions(token);
        setSessions(sessionPayload.sessions || []);
      } catch {
        setSessions([]);
      }
    } else {
      setManaged([]);
      setSessions([]);
    }
    if (nextRole === "superadmin") {
      try {
        const moderationPayload = await loadModeration(token);
        setQueue(moderationPayload.cases || []);
      } catch {
        setQueue([]);
      }
    } else {
      setQueue([]);
    }
  }, []);

  async function loadScenarios() {
    setLoading(true);
    try {
      const list = await fetchScenarios();
      setScenarios(list);
      setLoadError("");
    } catch {
      setLoadError("Не вдалося відкрити список кейсів.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadScenarios();
  }, []);

  useEffect(() => {
    const current = readSession();
    if (!current?.token) return undefined;
    let active = true;
    authRequest("/api/auth/me", {}, current.token)
      .then((payload) => {
        if (!active) return;
        const next = { ...current, user: payload.user };
        saveSession(next);
        setSession(next);
      })
      .catch(() => {
        if (!active) return;
        clearSession();
        setSession(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    refreshPrivate(session);
  }, [session, refreshPrivate]);

  function openScreen(next) {
    if (screen === "simulation" && next !== "simulation" && next !== "debrief" && !window.confirm("Прогрес проходження тесту буде втрачено. Ви справді хочете вийти?")) {
      return;
    }
    if (next !== "participant") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("room")) {
        url.searchParams.delete("room");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }
    setScreen(next);
    window.scrollTo(0, 0);
  }

  function guard(next) {
    if (next === "caseForm") setEditing(null);
    if ((next === "facilitator" || next === "caseForm") && !organizer) {
      openScreen(role === "guest" ? "login" : "dashboard");
      return;
    }
    if ((next === "analytics" || next === "dynamics" || next === "organizerStats") && !organizer && !admin) {
      openScreen(role === "guest" ? "login" : "dashboard");
      return;
    }
    if (next === "moderation" && role !== "superadmin") {
      openScreen("dashboard");
      return;
    }
    if ((next === "account" || next === "userStats" || next === "results") && role === "guest") {
      openScreen("login");
      return;
    }
    openScreen(next);
  }

  function playable() {
    const map = new Map(scenarios.map((item) => [item.id, item]));
    managed.forEach((item) => {
      if (item.source !== "builtin") map.set(item.id, item);
    });
    return [...map.values()];
  }

  function startCase(id) {
    const scenario = playable().find((item) => item.id === id);
    if (!scenario) return;
    setScenarioId(id);
    setStored(false);
    setRun({
      stepIndex: 0,
      nodeId: scenario.tree?.id || "",
      scores: freshScores(),
      history: [],
      lockedId: "",
      revealed: false
    });
    openScreen("simulation");
  }

  async function submitAuth(mode, payload) {
    setAuthPending(true);
    setAuthError("");
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const data = await authRequest(path, { method: "POST", body: JSON.stringify(payload) });
      saveSession(data);
      setSession(data);
      openScreen("account");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthPending(false);
    }
  }

  function logout() {
    clearSession();
    setSession(null);
    openScreen("dashboard");
  }

  useEffect(() => {
    if (screen !== "debrief" || !session?.token || !run?.history?.length) return undefined;
    const key = `${scenarioId}:${run.history.map((entry) => entry.option.id).join(".")}`;
    if (soloKey.current === key) return undefined;
    soloKey.current = key;
    let active = true;
    saveAttempt(session.token, {
      scenarioId,
      mode: "solo",
      choices: run.history.map((entry) => ({ stepId: entry.stepId, optionId: entry.option.id }))
    }).then((payload) => {
      if (!active) return;
      setStored(true);
      setAttempts((current) => [payload.attempt, ...current.filter((item) => item.id !== payload.attempt.id)]);
    }).catch(() => {
      if (active) setStored(false);
    });
    return () => {
      active = false;
    };
  }, [screen, session, run, scenarioId, stored]);

  async function authenticate(payload) {
    const data = await authRequest("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
    saveSession(data);
    setSession(data);
    return data;
  }

  async function saveGroupAttempt(payload) {
    if (!session?.token) return;
    try {
      const data = await saveAttempt(session.token, payload);
      setAttempts((current) => [data.attempt, ...current]);
    } catch {
      return;
    }
  }

  async function saveCase(payload) {
    if (!session?.token) return;
    setFormPending(true);
    setFormError("");
    try {
      if (editing?.id) await updateCase(session.token, editing.id, payload);
      else await createCase(session.token, payload);
      await loadScenarios();
      await refreshPrivate(session);
      openScreen(role === "superadmin" ? "moderation" : "cases");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setFormPending(false);
    }
  }

  async function removeCase(item) {
    if (!window.confirm(`Видалити кейс «${item.title}»?`)) return;
    try {
      await deleteCase(session.token, item.id);
      await loadScenarios();
      await refreshPrivate(session);
    } catch (error) {
      setFormError(error.message);
      openScreen("cases");
    }
  }

  async function decide(id, status) {
    setModerationNote("");
    try {
      await moderateCase(session.token, id, status);
      await loadScenarios();
      await refreshPrivate(session);
      setModerationNote(status === "published" ? "Кейс лишається публічним." : "Кейс прибрано з публічного доступу.");
    } catch (error) {
      setModerationNote(error.message);
    }
  }

  const scenario = playable().find((item) => item.id === scenarioId) || null;
  const localCases = managed.filter((item) => item.source === "custom" && (role !== "superadmin" || item.ownerId === session?.user?.id));
  const hostScenarios = organizer || admin ? playable() : scenarios;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header screen={screen} role={role} user={session?.user} onNavigate={guard} onLogout={logout} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {screen === "dashboard" && <Dashboard role={role} scenarios={scenarios} onNavigate={guard} onStart={startCase} />}
        {screen === "cases" && (
          <CaseSelector
            scenarios={scenarios}
            localCases={role === "guest" ? [] : localCases}
            onEdit={organizer ? (item) => { setEditing(item); setFormError(""); openScreen("caseForm"); } : null}
            onDelete={organizer ? removeCase : null}
            loading={loading}
            loadError={loadError}
            onReload={loadScenarios}
            onStart={startCase}
            onBack={() => openScreen("dashboard")}
          />
        )}
        {screen === "simulation" && scenario && run && (
          <Simulation scenario={scenario} run={run} setRun={setRun} onExit={() => openScreen("dashboard")} onDebrief={() => openScreen("debrief")} />
        )}
        {screen === "debrief" && scenario && run && (
          <Debriefing
            scenario={scenario}
            run={run}
            guest={!session}
            stored={stored}
            onAgain={() => startCase(scenario.id)}
            onHome={() => openScreen("dashboard")}
          />
        )}
        {screen === "library" && <Library onBack={() => openScreen("dashboard")} />}
        {screen === "facilitator" && organizer && (
          <GroupFacilitator scenarios={hostScenarios} token={session?.token} onBack={() => openScreen("dashboard")} />
        )}
        {screen === "participant" && (
          <RoomBoundary>
            <GroupParticipant
              scenarios={playable()}
              initialCode={entryCode}
              token={session?.token || ""}
              user={session?.user}
              onSave={saveGroupAttempt}
              onAuthenticate={authenticate}
              onBack={() => openScreen("dashboard")}
            />
          </RoomBoundary>
        )}
        {(screen === "login" || screen === "register" || screen === "staff") && (
          <AuthScreen
            mode={screen === "register" ? "register" : "login"}
            staff={screen === "staff"}
            error={authError}
            pending={authPending}
            onSubmit={(payload) => submitAuth(screen === "register" ? "register" : "login", payload)}
            onSwitch={() => { setAuthError(""); openScreen(screen === "register" ? "login" : "register"); }}
            onBack={() => openScreen("dashboard")}
          />
        )}
        {screen === "account" && session && (
          <Account session={session} attempts={attempts} sessions={sessions} onBack={() => openScreen("dashboard")} onSession={(next) => { saveSession(next); setSession(next); }} onOpen={guard} />
        )}
        {screen === "userStats" && session && (
          <UserStats user={session.user} attempts={attempts} onBack={() => openScreen("dashboard")} onStart={() => openScreen("cases")} onOpen={(item) => { setSelectedAttempt(item); openScreen("result"); }} />
        )}
        {screen === "results" && session && (
          <Results attempts={attempts} onBack={() => openScreen("dashboard")} onOpen={(item) => { setSelectedAttempt(item); openScreen("result"); }} />
        )}
        {screen === "result" && selectedAttempt && (
          <Debriefing
            scenario={{ title: selectedAttempt.scenarioTitle, code: selectedAttempt.scenarioCode, norms: [], steps: [] }}
            run={{ scores: selectedAttempt.scores, history: selectedAttempt.history }}
            stored
            onAgain={() => startCase(selectedAttempt.scenarioId)}
            onHome={() => openScreen(organizer ? "analytics" : "userStats")}
          />
        )}
        {screen === "caseForm" && (organizer || (admin && editing)) && (
          <CaseEditor initial={editing} role={role} pending={formPending} error={formError} onCancel={() => openScreen("dashboard")} onSave={saveCase} />
        )}
        {screen === "moderation" && role === "superadmin" && (
          <Moderation
            cases={[...queue, ...managed.filter((item) => item.source === "builtin")]}
            note={moderationNote}
            onBack={() => openScreen("dashboard")}
            onEdit={(item) => { setEditing(item); setFormError(""); openScreen("caseForm"); }}
            onDecide={decide}
          />
        )}
        {(screen === "analytics" || screen === "dynamics" || screen === "organizerStats") && (organizer || admin) && (
          <OrganizerStats
            key={screen}
            sessions={sessions}
            scenarios={hostScenarios}
            attempts={attempts}
            initialTab={screen === "dynamics" ? "dynamics" : screen === "organizerStats" ? "overview" : "analytics"}
            onBack={() => openScreen("dashboard")}
            onOpenAttempt={(item) => { setSelectedAttempt(item); openScreen("result"); }}
          />
        )}
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pb-8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600 sm:px-6">
        <span>Ethical Guard</span>
        <span className="flex flex-wrap gap-3">
          {role === "guest" ? <button type="button" onClick={() => openScreen("staff")} className="hover:text-olive-300">Службовий вхід</button> : null}
          <span>Шкали 0–100 · максимум {BASE_SCORE}</span>
        </span>
      </footer>
    </div>
  );
}
