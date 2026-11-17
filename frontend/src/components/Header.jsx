import { ROLE_LABELS } from "../services/authService";

export default function Header({ screen, role, user, onNavigate, onLogout }) {
  const casesOn = screen === "cases" || screen === "simulation" || screen === "debrief";
  const normsOn = screen === "library";
  const staff = role === "organizer" || role === "superadmin";
  return (
    <header>
      <div className="border-b border-olive-800 bg-olive-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-olive-300">EG-TRN · {ROLE_LABELS[role] || "Гість"}</span>
          {role === "guest" ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => onNavigate("login")} className="border border-olive-600 bg-olive-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-olive-100">Вхід</button>
              <button type="button" onClick={() => onNavigate("register")} className="border border-olive-400 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-olive-100">Реєстрація</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-olive-200">{user?.login || user?.email}</span>
              <button type="button" onClick={onLogout} className="border border-olive-700 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-olive-200">Вийти</button>
            </div>
          )}
        </div>
      </div>
      <div className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => onNavigate("dashboard")} className="flex min-w-0 items-center gap-3 text-left">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-olive-700 bg-olive-950 font-mono text-[11px] text-olive-300">EG</span>
            <span className="min-w-0">
              <span className="block truncate font-display text-xl tracking-[0.16em] text-zinc-100">ETHICAL GUARD</span>
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Тактичний тренажер</span>
            </span>
          </button>
          <nav className="flex flex-wrap items-center gap-2">
            <NavButton on={casesOn} onClick={() => onNavigate("cases")}>Кейси</NavButton>
            <NavButton on={normsOn} onClick={() => onNavigate("library")}>Норми</NavButton>
            <NavButton on={screen === "participant"} onClick={() => onNavigate("participant")}>Група</NavButton>
            {role !== "guest" ? <NavButton on={screen === "account"} onClick={() => onNavigate("account")}>Кабінет</NavButton> : null}
            {role !== "guest" ? <NavButton on={screen === "userStats"} onClick={() => onNavigate("userStats")}>Статистика</NavButton> : null}
            {role !== "guest" ? <NavButton on={screen === "results" || screen === "result"} onClick={() => onNavigate("results")}>Результати</NavButton> : null}
            {staff ? <NavButton on={screen === "caseForm"} onClick={() => onNavigate("caseForm")}>Кейс</NavButton> : null}
            {staff ? <NavButton on={screen === "facilitator"} onClick={() => onNavigate("facilitator")}>Заняття</NavButton> : null}
            {staff ? <NavButton on={screen === "dynamics" || screen === "analytics" || screen === "organizerStats"} onClick={() => onNavigate("analytics")}>Аналітика</NavButton> : null}
            {role === "superadmin" ? <NavButton on={screen === "moderation"} onClick={() => onNavigate("moderation")}>Модерація</NavButton> : null}
          </nav>
        </div>
      </div>
    </header>
  );
}

function NavButton({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-olive-500 ${on ? "border-olive-500 bg-olive-950 text-olive-200" : "border-zinc-800 text-zinc-400"}`}>
      {children}
    </button>
  );
}
