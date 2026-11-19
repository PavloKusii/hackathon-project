import { METRICS } from "../components/MetricsGauges";
import { ROLE_LABELS } from "../services/authService";
import { limitCaption } from "../timer";

const STEPS = [
  ["01", "Оберіть відкритий кейс", "Публічні ситуації доступні гостю, учаснику, організатору і супер-адміну без окремого дозволу."],
  ["02", "Пройдіть кроки", "На кожному кроці є кілька дій. Якщо організатор задав час на весь кейс або на окреме завдання, на екрані йде зворотний відлік. Без таймера рішення можна обдумати спокійно."],
  ["03", "Прочитайте розбір", "Після вибору видно пояснення, відкладені наслідки, правову опору і те, як змінилися три шкали."],
  ["04", "Збережіть слід, якщо ви в системі", "Гість проходить кейс повністю, але запис не створюється. Учасник, організатор і супер-адмін бачать історію в кабінеті, статистиці та результатах."],
  ["05", "Група лишається анонімною", "Організатор задає назву групи або лишає сесію за датою й часом. Він бачить лише відсотки виборів, а кожен учасник — власний розбір."]
];

const SCALES = [
  ["integrity", "Доброчесність", "Наскільки дія тримає документ, слово і факт разом. Плюс нараховується, коли ви фіксуєте побачене і не підтверджуєте неправдивий запис. Мінус — коли підпис, мовчання або зручна версія відсувають факт."],
  ["trust", "Довіра та репутація", "Чи зможуть колеги, командир і перевірка спиратися на ту саму версію, яку ви озвучили. Довіра зростає від прозорої доповіді і падає, коли пояснення розходиться з тим, що можна звірити."],
  ["effectiveness", "Ефективність", "Чи втримано темп завдання, графік і готовність підрозділу. Швидке рішення може підняти ефективність навіть тоді, коли доброчесність і довіра просідають. Розбір якраз показує цю ціну."]
];

export default function Dashboard({ role, scenarios, onNavigate, onStart }) {
  const organizer = role === "organizer";
  const admin = role === "superadmin";
  return (
    <section>
      <div className="max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-olive-400">Місія системи · {ROLE_LABELS[role] || "Гість"}</p>
        <h1 className="mt-3 font-display text-5xl leading-none tracking-wide text-zinc-50 sm:text-6xl">Симулятор етичних дилем</h1>
        <p className="mt-5 text-base leading-7 text-zinc-300">
          Ethical Guard створений, щоб тренувати службове рішення там, де темп завдання, довіра людей і вимога норми розходяться. Додаток дає безпечне місце прогнати дилему до кінця, побачити ціну кроку і повернутися до правової опори. Користь для учасника — особистий розбір. Користь для організатора — анонімна картина групи, без імен і без того, хто який варіант обрав.
        </p>
      </div>

      <section className="mt-8 border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive-400">Інструкція</p>
        <h2 className="mt-2 font-display text-3xl text-zinc-50">Як користуватися</h2>
        <div className="mt-4 flex flex-col gap-3">
          {STEPS.map(([index, title, text]) => (
            <article key={index} className="grid gap-3 border border-zinc-800 bg-zinc-950/70 p-4 sm:grid-cols-[4rem_minmax(0,1fr)]">
              <p className="font-mono text-sm text-olive-400">{index}</p>
              <div>
                <h3 className="font-display text-2xl text-zinc-50">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-4 border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive-400">Шкала 0–100</p>
            <h2 className="mt-2 font-display text-3xl text-zinc-50">Як нараховуються бали</h2>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Максимум 100 · старт 100</p>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
          Кожна шкала починається зі 100. Це максимум і повний запас на старті. Варіант відповіді додає або віднімає бали в межах від −40 до +40 за одну шкалу. Підсумок не піднімається вище 100 і не опускається нижче 0. Додатні бали повертають уже втрачене. Від’ємні показують ціну короткого спокою, неправдивого запису або втраченого темпу.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {SCALES.map(([key, title, text]) => {
            const metric = METRICS.find((item) => item.key === key);
            return (
              <article key={key} className="border border-zinc-800 bg-zinc-950 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: metric?.color }}>{metric?.short}</p>
                <h3 className="mt-2 font-display text-2xl text-zinc-50">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {role === "guest" ? (
          <>
            <button type="button" onClick={() => onNavigate("login")} className="border border-olive-700 bg-olive-950 p-5 text-left hover:border-olive-500">
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-olive-300">Обліковий запис</span>
              <span className="mt-2 block font-display text-2xl text-zinc-100">Увійти →</span>
              <span className="mt-1 block text-sm text-zinc-400">Пошта або логін і пароль</span>
            </button>
            <button type="button" onClick={() => onNavigate("register")} className="border border-zinc-800 bg-zinc-900/80 p-5 text-left hover:border-olive-500">
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-olive-400">Новий учасник</span>
              <span className="mt-2 block font-display text-2xl text-zinc-100">Реєстрація →</span>
              <span className="mt-1 block text-sm text-zinc-400">Пошта, пароль, підтвердження і роль: учасник або організатор</span>
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => onNavigate("account")} className="border border-zinc-800 bg-zinc-900/80 p-5 text-left hover:border-olive-500">
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-olive-400">{role === "organizer" ? "Для організатора" : role === "superadmin" ? "Для супер-адміна" : "Для учасника"}</span>
              <span className="mt-2 block font-display text-2xl text-zinc-100">{role === "organizer" ? "Кабінет організатора →" : role === "superadmin" ? "Кабінет супер-адміна →" : "Особистий кабінет →"}</span>
              <span className="mt-1 block text-sm text-zinc-400">Роль, пошта і перехід до збережених даних</span>
            </button>
            {role === "participant" ? (
              <button type="button" onClick={() => onNavigate("userStats")} className="border border-zinc-800 bg-zinc-900/80 p-5 text-left hover:border-olive-500">
                <span className="font-mono text-[10px] uppercase tracking-[.18em] text-olive-400">Статистика</span>
                <span className="mt-2 block font-display text-2xl text-zinc-100">Статистика і результати →</span>
                <span className="mt-1 block text-sm text-zinc-400">Показники проходжень і список розборів</span>
              </button>
            ) : null}
          </>
        )}
        {organizer ? (
          <>
            <button type="button" onClick={() => onNavigate("dynamics")} className="border border-zinc-800 bg-zinc-900/80 p-5 text-left hover:border-olive-500">
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-olive-400">Для організатора</span>
              <span className="mt-2 block font-display text-2xl text-zinc-100">Динаміка проходження →</span>
              <span className="mt-1 block text-sm text-zinc-400">Як змінювалась зведена картина від кроку до кроку</span>
            </button>
            <button type="button" onClick={() => onNavigate("analytics")} className="border border-zinc-800 bg-zinc-900/80 p-5 text-left hover:border-olive-500">
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-olive-400">Для організатора</span>
              <span className="mt-2 block font-display text-2xl text-zinc-100">Аналітика занять →</span>
              <span className="mt-1 block text-sm text-zinc-400">Групи, відсотки варіантів і загальна статистика сесій</span>
            </button>
          </>
        ) : null}
        {admin ? (
          <button type="button" onClick={() => onNavigate("moderation")} className="border border-zinc-800 bg-zinc-900/80 p-5 text-left hover:border-olive-500 sm:col-span-2">
            <span className="font-mono text-[10px] uppercase tracking-[.18em] text-olive-400">Для супер-адміна</span>
            <span className="mt-2 block font-display text-2xl text-zinc-100">Модерація публічних кейсів →</span>
            <span className="mt-1 block text-sm text-zinc-400">Рішення про доступ і редагування будь-якого сценарію</span>
          </button>
        ) : null}
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">Відкрито всім</p>
            <h2 className="mt-2 font-display text-4xl text-zinc-50">Публічні кейси</h2>
          </div>
          <button type="button" onClick={() => onNavigate("cases")} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300">Усі кейси</button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {scenarios.length === 0 ? <p className="text-sm text-zinc-400">Публічні кейси з’являться тут, щойно сервер віддасть список.</p> : null}
          {scenarios.slice(0, 3).map((item) => (
            <article key={item.id} className="flex flex-col border border-olive-900 border-l-4 border-l-olive-500 bg-zinc-900/80 p-5">
              <p className="font-mono text-xs text-olive-400">{item.code}</p>
              <h3 className="mt-2 font-display text-3xl leading-none text-zinc-50">{item.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-zinc-400">{item.summary}</p>
              <button type="button" onClick={() => onStart(item.id)} className="mt-4 border border-olive-600 bg-olive-800 px-4 py-3 text-left font-display text-xl text-olive-100">{limitCaption(item) ? `Почати · ${limitCaption(item)}` : "Почати"}</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
