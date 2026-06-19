import PageHeader from '../../components/PageHeader'

export default function ComingSoon({
  index,
  title,
  subtitle,
  phase,
  cards,
}: {
  index: string
  title: string
  subtitle: string
  phase: string
  cards: { name: string; detail: string }[]
}) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader index={index} title={title} subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-5 inline-block border-[1.5px] border-dashed border-signal bg-signal/5 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-signal-deep">
          Backend ready · UI lands in {phase}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.name} className="press !shadow-hard-sm p-5">
              <p className="font-display text-lg font-semibold">{c.name}</p>
              <p className="mt-1 text-sm text-ink-soft">{c.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
