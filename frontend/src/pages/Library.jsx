const NORMS = [
  {
    code: "1700-VII",
    title: "Закон України «Про запобігання корупції»",
    text: "Подарунки, неправомірна вигода і конфлікт інтересів, коли службове рішення ще попереду або щойно зроблене.",
    href: "https://zakon.rada.gov.ua/laws/show/1700-18"
  },
  {
    code: "551-XIV",
    title: "Дисциплінарний статут Збройних Сил України",
    text: "Правдиве виконання обов’язків і відомості, від яких залежать служба, облік і довіра до доповіді.",
    href: "https://zakon.rada.gov.ua/laws/show/551-14"
  },
  {
    code: "548-XIV",
    title: "Статут внутрішньої служби Збройних Сил України",
    text: "Сумлінне ведення дорученої справи, достовірний облік і вчасна доповідь про обставини, що змінюють рішення командира.",
    href: "https://zakon.rada.gov.ua/laws/show/548-14"
  },
  {
    code: "GC IV",
    title: "Женевські конвенції. Захист цивільного населення",
    text: "Повага до цивільних осіб і цивільного майна під час навчань.",
    href: "https://ihl-databases.icrc.org/en/ihl-treaties/gciv-1949"
  },
  {
    code: "BI",
    title: "NATO Building Integrity",
    text: "Прозорість, підзвітність і стійкість оборонних інституцій до неналежного впливу.",
    href: "https://www.nato.int/en/what-we-do/partnerships-and-cooperation/building-integrity"
  }
];

export default function Library({ onBack }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-500">Довідник</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">Бібліотека норм</h1>
        </div>
        <button type="button" onClick={onBack} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300 hover:border-amber-600">На головну</button>
      </div>
      <div className="mt-6 border border-amber-900/70 bg-zinc-950">
        <div className="border-b border-amber-900/70 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-500">Нормативна база</p>
        </div>
        <div className="divide-y divide-zinc-800">
          {NORMS.map((item, index) => (
            <article key={item.code} className="grid gap-4 px-5 py-5 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{String(index + 1).padStart(2, "0")}</p>
                <span className="mt-2 inline-flex border border-amber-800 bg-zinc-900 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-400">Норма</span>
              </div>
              <div>
                <p className="font-mono text-xs text-amber-500/90">{item.code}</p>
                <h2 className="mt-1 font-display text-2xl tracking-wide text-zinc-50">{item.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{item.text}</p>
                <a className="mt-3 inline-flex border border-amber-800 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-300 hover:border-amber-500" href={item.href} target="_blank" rel="noopener noreferrer">Текст документа</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
