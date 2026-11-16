const MODES = [
  ["cases", "01", "Самостійний тренажер", "Особисте проходження кейса. Після кожного кроку оновлюються доброчесність, довіра та репутація, ефективність."],
  ["facilitator", "02", "Групове заняття (Режим викладача)", "Жива кімната з кодом і QR. Слухачі заходять з телефону й голосують синхронно з кроком викладача."],
  ["library", "03", "Бібліотека норм", "Статути, закони та міжнародні стандарти окремо від тактичних кейсів."]
];

export default function Dashboard({ onNavigate }) {
  return (
    <section>
      <div className="max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-olive-400">Місія системи</p>
        <h1 className="mt-3 font-display text-5xl leading-none tracking-wide text-zinc-50 sm:text-6xl">Симулятор етичних дилем</h1>
        <p className="mt-5 text-base leading-7 text-zinc-300">
          Ethical Guard тренує вибір там, де службовий темп, довіра людей і вимога норми розходяться. Тренажер показує ціну кроку і правову опору рішення. Підсумкові шкали лишаються робочим дзеркалом проходження.
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {MODES.map(([screen, index, title, text]) => (
          <button key={screen} type="button" onClick={() => onNavigate(screen)} className="group flex w-full items-stretch border border-zinc-800 bg-zinc-900/80 text-left hover:border-olive-500">
            <span className="grid w-14 shrink-0 place-items-center border-r border-zinc-800 font-mono text-sm text-olive-400 sm:w-20">{index}</span>
            <span className="flex flex-1 flex-col gap-1 px-4 py-5 sm:px-6">
              <span className="font-display text-[1.7rem] leading-none tracking-[0.04em] text-zinc-50 sm:text-3xl">{title}</span>
              <span className="max-w-3xl text-sm leading-6 text-zinc-400">{text}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
