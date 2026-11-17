import { useState } from "react";

export default function Registration({ onBack, onRegister }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  function submit(event) {
    event.preventDefault();
    const current = JSON.parse(localStorage.getItem("eg-user") || "null");
    if (mode === "login" && current && current.email.toLowerCase() !== email.trim().toLowerCase()) { setNotice("Для демо входу використайте пошту зареєстрованого профілю."); return; }
    if (mode === "login" && !current) { setNotice("Профіль не знайдено. Створіть обліковий запис у вкладці реєстрації."); return; }
    onRegister(mode === "login" ? current : { name: name.trim(), email: email.trim(), joinedAt: new Date().toISOString() });
  }
  return <section className="mx-auto grid max-w-4xl overflow-hidden border border-zinc-800 bg-zinc-900/80 md:grid-cols-2">
    <aside className="flex min-h-64 flex-col justify-between bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-olive-800 via-zinc-900 to-zinc-950 p-7 sm:p-10">
      <button onClick={onBack} className="self-start font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white">← На головну</button>
      <div><p className="font-mono text-xs uppercase tracking-[.2em] text-olive-300">Ethical Guard / профіль</p><h1 className="mt-4 font-display text-4xl text-white sm:text-5xl">Практика, що залишає слід</h1><p className="mt-4 text-sm leading-6 text-zinc-300">Зберігайте проходження та відстежуйте розвиток навичок етичного рішення.</p></div>
      <p className="mt-8 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Навчальний прототип · дані зберігаються у цьому браузері</p>
    </aside>
    <div className="p-6 sm:p-10"><div className="flex border-b border-zinc-800"><button onClick={() => { setMode("login"); setNotice(""); }} className={`border-b-2 px-4 py-3 font-mono text-xs uppercase tracking-widest ${mode === "login" ? "border-olive-500 text-olive-300" : "border-transparent text-zinc-500"}`}>Вхід</button><button onClick={() => { setMode("register"); setNotice(""); }} className={`border-b-2 px-4 py-3 font-mono text-xs uppercase tracking-widest ${mode === "register" ? "border-olive-500 text-olive-300" : "border-transparent text-zinc-500"}`}>Реєстрація</button></div>
      <h2 className="mt-7 font-display text-3xl text-white">{mode === "login" ? "Раді бачити знову" : "Створити профіль"}</h2><p className="mt-2 text-sm text-zinc-400">{mode === "login" ? "Увійдіть, щоб продовжити навчання." : "Це демо профіль без надсилання даних на сервер."}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>{mode === "register" && <label className="block text-sm text-zinc-300">Ім’я<input required minLength="2" value={name} onChange={e => setName(e.target.value)} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" placeholder="Ваше ім’я" /></label>}<label className="block text-sm text-zinc-300">Електронна пошта<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" placeholder="name@example.com" /></label><label className="block text-sm text-zinc-300">Пароль<input required minLength="6" type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" placeholder="Не менше 6 символів" /></label><button className="w-full border border-olive-600 bg-olive-800 px-4 py-3 font-display text-xl tracking-widest text-white hover:bg-olive-700">{mode === "login" ? "Увійти" : "Зареєструватися"}</button><p aria-live="polite" className="min-h-5 text-sm text-amber-300">{notice}</p></form>
    </div>
  </section>;
}
