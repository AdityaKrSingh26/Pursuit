import type { GapFrequencyResponse } from '../../lib/types'

interface GapFrequencyListProps {
  data: GapFrequencyResponse
}

export default function GapFrequencyList({ data }: GapFrequencyListProps) {
  return (
    <div className="press !shadow-hard p-5 bg-[#FBF8F0] border-1.5 border-[#1A1712] h-full flex flex-col">
      <div className="mb-4">
        <p className="label text-[#1A1712]">Skill Gaps</p>
        <p className="text-xs text-[#5C5446] mt-0.5">Skills you are missing, ranked by occurrence</p>
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
                className="flex items-center justify-between p-3 border-1.5 border-[#1A1712] bg-[#FBF8F0]"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-[#1A1712]">{item.skill}</span>
                  <p className="text-[10px] text-[#5C5446] font-mono mt-0.5">
                    missing in {item.missingCount} {item.missingCount === 1 ? 'application' : 'applications'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border-1.5 border-[#1A1712] ${
                      isHighDemand
                        ? 'bg-missing text-[#FBF8F0]'
                        : 'bg-paper-3 text-[#1A1712]'
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
