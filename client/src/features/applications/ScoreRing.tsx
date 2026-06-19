export default function ScoreRing({
  score,
  skillOverlapPct,
  llmRelevanceScore,
}: {
  score: number
  skillOverlapPct: number
  llmRelevanceScore: number
}) {
  const r = 34
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c
  const color = score >= 70 ? '#1F6B5C' : score >= 45 ? '#C08A1E' : '#C0392B'

  return (
    <div className="group relative flex flex-col items-center">
      <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
        <circle cx="46" cy="46" r={r} fill="none" stroke="#1A171215" strokeWidth="8" />
        <circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="butt"
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-black leading-none">{Math.round(score)}</span>
        <span className="label !text-[8px]">match</span>
      </div>
      <div className="mt-2 hidden whitespace-nowrap border border-line bg-paper-3 px-2 py-1 font-mono text-[9px] text-ink-soft group-hover:block">
        skill overlap {Math.round(skillOverlapPct)}% · llm {Math.round(llmRelevanceScore)}
      </div>
    </div>
  )
}
