import { useState } from "react";

export default function AuthScreen({ mode, onSubmit, onSwitch, onBack, error, pending, staff = false }) {
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [role, setRole] = useState("");
  const [localError, setLocalError] = useState("");
  const register = mode === "register";

  function submit(event) {
    event.preventDefault();
    setLocalError("");
    if (register && role !== "participant" && role !== "organizer") {
      setLocalError("Оберіть роль: учасник або організатор.");
      return;
    }
    if (register && password !== passwordConfirm) {
      setLocalError("Підтвердження пароля не збігається.");
      return;
    }
    onSubmit({ email, login, password, passwordConfirm, role });
  }

  return (
    <section className="mx-auto max-w-lg">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">{register ? "Новий обліковий запис" : "Вхід"}</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">{register ? "Реєстрація" : "Увійти"}</h1>
        </div>
        <button type="button" onClick={onBack} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300 hover:border-olive-500">На головну</button>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-400">
        {register
          ? "Оберіть роль учасника або організатора."
          : staff
            ? "Службовий вхід супер-адміна. Публічна реєстрація цієї ролі не видає."
            : "Вхід за електронною поштою або логіном і паролем."}
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4 border border-zinc-800 bg-zinc-900/80 p-5">
        <label className="flex flex-col gap-2 text-sm text-zinc-300">
          {register ? "Електронна пошта" : "Електронна пошта або логін"}
          <input type={register ? "email" : "text"} autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
        </label>
        {register ? (
          <label className="flex flex-col gap-2 text-sm text-zinc-300">
            Логін, за бажанням
            <input type="text" autoComplete="off" value={login} onChange={(event) => setLogin(event.target.value)} className="border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" placeholder="Якщо порожньо, візьмемо частину пошти" />
          </label>
        ) : null}
        <label className="flex flex-col gap-2 text-sm text-zinc-300">
          Пароль
          <input type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} className="border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
        </label>
        {register ? (
          <fieldset className="flex flex-col gap-2 text-sm text-zinc-300">
            <legend>Роль</legend>
            <label className={`border px-3 py-3 ${role === "participant" ? "border-olive-500 bg-olive-950" : "border-zinc-700"}`}>
              <input className="mr-2" type="radio" name="role" checked={role === "participant"} onChange={() => setRole("participant")} />
              Учасник — особисті проходження, статистика і результати
            </label>
            <label className={`border px-3 py-3 ${role === "organizer" ? "border-olive-500 bg-olive-950" : "border-zinc-700"}`}>
              <input className="mr-2" type="radio" name="role" checked={role === "organizer"} onChange={() => setRole("organizer")} />
              Організатор — групові заняття і власні кейси
            </label>
          </fieldset>
        ) : null}
        {register ? (
          <label className="flex flex-col gap-2 text-sm text-zinc-300">
            Підтвердження пароля
            <input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} className="border border-zinc-700 bg-zinc-950 px-3 py-3 text-zinc-100" />
          </label>
        ) : null}
        {register ? <p className="text-xs leading-5 text-zinc-500">Від 8 символів, щонайменше одна літера та одна цифра.</p> : null}
        {staff ? <p className="text-xs leading-5 text-zinc-500">Стартовий супер-адмін: логін admin, пошта admin@ethical-guard.local, пароль Guard-Admin-2026. Його можна змінити змінними EG_SUPERADMIN_EMAIL і EG_SUPERADMIN_PASSWORD до першого запуску.</p> : null}
        <p className="min-h-5 text-sm text-amber-400" aria-live="polite">{localError || error}</p>
        <button type="submit" disabled={pending} className="border border-olive-600 bg-olive-800 px-5 py-3 font-display text-xl tracking-[0.1em] text-olive-100 hover:border-olive-500 hover:bg-olive-700 disabled:opacity-50">
          {pending ? "Зачекайте" : register ? "Створити обліковий запис" : "Увійти"}
        </button>
        {staff ? null : (
          <button type="button" onClick={onSwitch} className="text-left font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 hover:text-olive-300">
            {register ? "Вже є обліковий запис" : "Створити обліковий запис"}
          </button>
        )}
      </form>
    </section>
  );
}
