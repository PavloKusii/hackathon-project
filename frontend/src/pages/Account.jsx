import { useEffect, useState } from "react";
import { ROLE_LABELS, authRequest } from "../services/authService";

const ASSIGNABLE = ["participant", "organizer", "superadmin"];

const TONE = {
  participant: "from-olive-800 via-zinc-900 to-zinc-950",
  organizer: "from-amber-900 via-zinc-900 to-zinc-950",
  superadmin: "from-zinc-700 via-olive-950 to-zinc-950"
};

export default function Account({ session, attempts = [], sessions = [], onBack, onSession, onOpen }) {
  const user = session?.user;
  const role = user?.role;
  const [people, setPeople] = useState([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (role !== "superadmin" || !session?.token) return undefined;
    let active = true;
    authRequest("/api/admin/users", {}, session.token)
      .then((payload) => {
        if (active) setPeople(payload.users || []);
      })
      .catch((error) => {
        if (active) setNote(error.message);
      });
    return () => {
      active = false;
    };
  }, [role, session?.token]);

  async function changeRole(id, nextRole) {
    setNote("");
    try {
      const payload = await authRequest(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole })
      }, session.token);
      setPeople((current) => current.map((item) => (item.id === id ? payload.user : item)));
      if (id === user.id) onSession({ ...session, user: payload.user });
      setNote("Роль оновлено.");
    } catch (error) {
      setNote(error.message);
    }
  }

  return (
    <section>
      <div className={`overflow-hidden border border-zinc-800 bg-gradient-to-br ${TONE[role] || TONE.participant} p-6 sm:p-8`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-olive-200">{cabinetTitle(role)}</p>
            <h1 className="mt-2 font-display text-5xl tracking-wide text-white sm:text-6xl">{user?.login || "Профіль"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">{roleCopy(role)}</p>
          </div>
          <button type="button" onClick={onBack} className="border border-zinc-600 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-200">На головну</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Tile label="Роль" value={ROLE_LABELS[role] || "—"} />
          <Tile label="Пошта" value={user?.email || "—"} />
          <Tile label="Логін" value={user?.login || "—"} />
        </div>
      </div>

      {role === "participant" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card kicker="Проходження" title="Моя статистика" text={`${attempts.length} збережених розборів і динаміка шкал.`} onClick={() => onOpen("userStats")} />
          <Card kicker="Розбір" title="Результати" text="Ваші відповіді, слабші рішення і пояснення." onClick={() => onOpen("results")} />
          <Card kicker="Практика" title="Публічні кейси" text="Самостійне проходження без обмеження часу." onClick={() => onOpen("cases")} />
          <Card kicker="Група" title="Код кімнати" text="Вхід за кодом або QR: гість або цей обліковий запис." onClick={() => onOpen("participant")} />
        </div>
      ) : null}

      {role === "organizer" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card kicker="Автор" title="Новий кейс" text="Локальний JSON або подання на публічну модерацію." onClick={() => onOpen("caseForm")} />
          <Card kicker="Кімната" title="Групове заняття" text={`${sessions.length} збережених сесій. Учасники лишаються анонімними.`} onClick={() => onOpen("facilitator")} />
          <Card kicker="Група" title="Динаміка проходження" text="Зважена лінія шкал від кроку до кроку." onClick={() => onOpen("dynamics")} />
          <Card kicker="Група" title="Аналітика занять" text="Відсотки варіантів і загальна статистика сесій." onClick={() => onOpen("analytics")} />
          <Card kicker="Особисте" title="Моя статистика" text="Ваші власні проходження, окремо від групи." onClick={() => onOpen("userStats")} />
          <Card kicker="Особисте" title="Результати" text="Детальний розбір збережених відповідей." onClick={() => onOpen("results")} />
        </div>
      ) : null}

      {role === "superadmin" ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Card kicker="Доступ" title="Модерація кейсів" text="Які подані сценарії лишаються публічними, і редагування будь-якого з них." onClick={() => onOpen("moderation")} />
            <Card kicker="Огляд" title="Аналітика всіх груп" text="Зведення без імен. Створювати кімнати може лише організатор." onClick={() => onOpen("analytics")} />
            <Card kicker="Огляд" title="Динаміка проходження" text="Портрет груп за кроками, не окремі люди." onClick={() => onOpen("dynamics")} />
            <Card kicker="Облік" title="Користувачі" text={`${people.length || "…"} облікових записів у локальному сховищі.`} onClick={() => document.getElementById("people")?.scrollIntoView({ behavior: "smooth" })} />
          </div>
          <section id="people" className="mt-6 border border-amber-900/60 bg-zinc-950 p-5">
            <h2 className="font-display text-3xl text-zinc-50">Ролі облікових записів</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Публічна реєстрація дає лише учасника або організатора. Супер-адміна призначають тут або він входить службовим обліковим записом.</p>
            <div className="mt-4 flex flex-col gap-3">
              {people.map((person) => (
                <article key={person.id} className="flex flex-col gap-3 border border-zinc-800 bg-zinc-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-zinc-100">{person.email}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{person.login} · {ROLE_LABELS[person.role]}</p>
                  </div>
                  <label className="text-xs text-zinc-400">
                    Роль
                    <select value={person.role} onChange={(event) => changeRole(person.id, event.target.value)} className="mt-1 block border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
                      {ASSIGNABLE.map((item) => (
                        <option key={item} value={item}>{ROLE_LABELS[item]}</option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
      <p className="mt-4 min-h-5 text-sm text-amber-400" aria-live="polite">{note}</p>
    </section>
  );
}

function Tile({ label, value }) {
  return (
    <article className="border border-white/10 bg-black/30 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">{label}</p>
      <p className="mt-2 break-all text-lg text-zinc-50">{value}</p>
    </article>
  );
}

function Card({ kicker, title, text, onClick }) {
  return (
    <button type="button" onClick={onClick} className="border border-zinc-800 bg-zinc-900/80 p-5 text-left hover:border-olive-500">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-400">{kicker}</span>
      <span className="mt-2 block font-display text-3xl text-zinc-50">{title}</span>
      <span className="mt-2 block text-sm leading-6 text-zinc-400">{text}</span>
    </button>
  );
}

function cabinetTitle(role) {
  if (role === "superadmin") return "Кабінет супер-адміна";
  if (role === "organizer") return "Кабінет організатора";
  return "Особистий кабінет";
}

function roleCopy(role) {
  if (role === "superadmin") return "Окремий контур доступу: ролі, модерація і редагування всіх сценаріїв. Групові кімнати й нові кейси створює організатор.";
  if (role === "organizer") return "Ваш контур: власні кейси, кімнати з кодом і QR, динаміка та аналітика без імен учасників.";
  if (role === "participant") return "Ваш контур: статистика, результати і проходження, які зберігаються на цьому обліковому записі.";
  return "Сеанс без облікового запису.";
}
