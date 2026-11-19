const STATUS = {
  pending: "На розгляді",
  published: "Публічний",
  rejected: "Приховано",
  local: "Локальний"
};

export default function Moderation({ cases, onBack, onEdit, onDecide, note }) {
  const ordered = [...cases].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-olive-400">Супер-адмін</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-zinc-50 sm:text-5xl">Публічні кейси</h1>
        </div>
        <button type="button" onClick={onBack} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300">На головну</button>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">Тут увесь перелік кейсів, які організатори надіслали в публічний доступ. Залишайте їх видимими для всіх або ховайте. Редагувати можна будь-який сценарій системи.</p>
      <div className="mt-6 flex flex-col gap-3">
        {ordered.length === 0 ? <p className="text-sm text-zinc-400">Поданих кейсів ще немає.</p> : null}
        {ordered.map((item) => (
          <article key={item.id} className="border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-olive-400">{item.code} · {STATUS[item.status] || item.status}</p>
                <h2 className="mt-2 font-display text-3xl text-zinc-50">{item.title}</h2>
                <p className="mt-2 text-sm text-zinc-400">{item.summary}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{item.ownerEmail || "вбудований сценарій"} · {item.tree ? `дерево, ${item.steps?.length || 0} питань` : `кроків ${item.steps?.length || 0}`}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onEdit(item)} className="border border-zinc-600 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-200">Редагувати</button>
                {item.source !== "builtin" && item.status !== "published" ? (
                  <button type="button" onClick={() => onDecide(item.id, "published")} className="border border-olive-600 bg-olive-800 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-olive-100">Залишити публічним</button>
                ) : null}
                {item.source !== "builtin" && item.status !== "rejected" ? (
                  <button type="button" onClick={() => onDecide(item.id, "rejected")} className="border border-amber-700 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200">Прибрати з доступу</button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-4 min-h-5 text-sm text-amber-400">{note}</p>
    </section>
  );
}
