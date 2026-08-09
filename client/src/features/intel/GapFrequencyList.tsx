import type { GapFrequencyResponse } from '../../lib/types'

interface GapFrequencyListProps {
  data: GapFrequencyResponse
}

export default function GapFrequencyList({ data }: GapFrequencyListProps) {
  return (
    <div className="press !shadow-hard p-5 bg-paper-3 border-[1.5px] border-line h-full flex flex-col">
      <div className="mb-4">
        <p className="label">Skill Gaps</p>
        <p className="text-xs text-ink-soft mt-0.5">Skills you are missing, ranked by occurrence</p>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[420px] pr-1 space-y-2">
        {data.length === 0 ? (
          <p className="text-xs text-ink-faint font-mono">No skill gaps detected yet.</p>
        ) : (
          data.map((item) => {
            const isHighDemand = item.demandPct > 30
            return (
              <div
                key={item.skill}
                className="flex items-center justify-between p-3 border-[1.5px] border-line bg-paper-3"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-ink">{item.skill}</span>
                  <p className="text-[10px] text-ink-soft font-mono mt-0.5">
                    missing in {item.missingCount} {item.missingCount === 1 ? 'application' : 'applications'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border-[1.5px] border-line ${
                      isHighDemand
                        ? 'bg-missing text-paper-3'
                        : 'bg-paper-3 text-ink'
                    }`}
                  >
                    {item.demandPct}% Demand
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
