import { Component, useEffect, useState } from "react";
import { fetchScenarios } from "./services/scenarioService";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import CaseSelector from "./pages/CaseSelector";
import Simulation from "./pages/Simulation";
import Debriefing from "./pages/Debriefing";
import Library from "./pages/Library";
import GroupFacilitator from "./pages/GroupFacilitator";
import GroupParticipant from "./pages/GroupParticipant";

export const BASE_SCORE = 62;

export function freshScores() {
  return { integrity: BASE_SCORE, trust: BASE_SCORE, effectiveness: BASE_SCORE };
}

function roomFromLocation() {
  return (new URLSearchParams(window.location.search).get("room") || "").trim();
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
  const [screen, setScreen] = useState(() => (roomFromLocation() ? "participant" : "dashboard"));
  const [entryCode] = useState(() => roomFromLocation());
  const [scenarios, setScenarios] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [scenarioId, setScenarioId] = useState("");
  const [run, setRun] = useState(null);

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

  function openScreen(next) {
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

  function startCase(id) {
    setScenarioId(id);
    setRun({
      stepIndex: 0,
      scores: freshScores(),
      history: [],
      lockedId: "",
      revealed: false
    });
    openScreen("simulation");
  }

  const scenario = scenarios.find((item) => item.id === scenarioId) || null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header screen={screen} onNavigate={openScreen} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {screen === "dashboard" && <Dashboard onNavigate={openScreen} />}
        {screen === "cases" && (
          <CaseSelector
            scenarios={scenarios}
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
            onAgain={() => startCase(scenario.id)}
            onHome={() => openScreen("dashboard")}
          />
        )}
        {screen === "library" && <Library onBack={() => openScreen("dashboard")} />}
        {screen === "facilitator" && <GroupFacilitator scenarios={scenarios} onBack={() => openScreen("dashboard")} />}
        {screen === "participant" && (
          <RoomBoundary>
            <GroupParticipant scenarios={scenarios} initialCode={entryCode} onBack={() => openScreen("dashboard")} />
          </RoomBoundary>
        )}
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pb-8 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600 sm:px-6">
        <span>Ethical Guard · прототип</span>
        <span>Шкали 0–100 · старт {BASE_SCORE}</span>
      </footer>
    </div>
  );
}
