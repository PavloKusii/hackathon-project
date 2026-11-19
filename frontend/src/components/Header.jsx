import { ROLE_LABELS } from "../services/authService";

const NAVIGATION = [
  { screen: "library", label: "Норми", active: (screen) => screen === "library" },
  { screen: "participant", label: "Підрозділ", active: (screen) => screen === "participant" }
];

export default function Header({ screen, role, user, onNavigate, onLogout }) {
  const organizer = role === "organizer";
  return (
    <header>
      <div className="border-b border-olive-800 bg-olive-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-olive-300">EG-TRN · {ROLE_LABELS[role] || "Гість"}</span>
          {role === "guest" ? (
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => onNavigate("login")} className="border border-olive-600 bg-olive-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-olive-100 hover:bg-olive-700">Вхід</button>
              <button type="button" onClick={() => onNavigate("register")} className="hidden border border-olive-400 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-olive-100 hover:bg-olive-900 sm:inline-flex">Реєстрація</button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <span className="max-w-40 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-olive-200 sm:max-w-64">{user?.login || user?.email}</span>
              <button type="button" aria-label="Відкрити кабінет користувача" title="Кабінет" onClick={() => onNavigate("account")} className="grid h-8 w-8 shrink-0 place-items-center border border-olive-700 text-olive-200 transition-colors hover:border-olive-400 hover:bg-olive-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive-400">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="3.25" />
                  <path d="M5.5 20c.5-3.2 2.8-5 6.5-5s6 1.8 6.5 5" />
                </svg>
              </button>
              <button type="button" onClick={onLogout} className="border border-olive-700 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-olive-200 hover:border-olive-400 hover:bg-olive-900">Вийти</button>
            </div>
          )}
        </div>
      </div>
      <div className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <button type="button" onClick={() => onNavigate("dashboard")} className="flex min-w-0 items-center gap-3 text-left">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-olive-700 bg-olive-950 font-mono text-[11px] text-olive-300">EG</span>
            <span className="min-w-0">
              <span className="block truncate font-display text-xl tracking-[0.16em] text-zinc-100">ETHICAL GUARD</span>
              <span className="block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Тактичний тренажер</span>
            </span>
          </button>
          <nav aria-label="Основна навігація" className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0">
            {NAVIGATION.map((item) => <NavButton key={item.screen} on={item.active(screen)} onClick={() => onNavigate(item.screen)}>{item.label}</NavButton>)}
            {role !== "guest" ? <NavButton on={["userStats", "result", "analytics", "dynamics", "organizerStats"].includes(screen)} onClick={() => onNavigate(organizer ? "analytics" : "userStats")}>Статистика</NavButton> : null}
            {organizer ? <NavButton on={screen === "caseForm"} onClick={() => onNavigate("caseForm")}>Створити кейс</NavButton> : null}
            {organizer ? <NavButton on={screen === "facilitator"} onClick={() => onNavigate("facilitator")}>Заняття</NavButton> : null}
            {role === "superadmin" ? <NavButton on={screen === "moderation"} onClick={() => onNavigate("moderation")}>Модерація</NavButton> : null}
          </nav>
        </div>
      </div>
    </header>
  );
}

function NavButton({ on, onClick, children }) {
  return (
    <button type="button" aria-current={on ? "page" : undefined} onClick={onClick} className={`shrink-0 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors hover:border-olive-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive-400 ${on ? "border-olive-500 bg-olive-950 text-olive-200" : "border-zinc-800 text-zinc-400"}`}>
      {children}
    </button>
  );
}
