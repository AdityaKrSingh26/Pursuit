interface StatsRowProps {
  total: number
  responseRate: number
  ghostRate: number
  medianDaysApplied: number
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="press !shadow-hard-sm flex flex-col justify-between p-4 bg-[#FBF8F0] border-1.5 border-[#1A1712]">
      <span className="label text-xs uppercase tracking-wider text-[#5C5446]">{label}</span>
      <span
        className={`mt-3 font-display text-4xl font-black leading-none ${
          accent ? 'text-[#DD4814]' : 'text-[#1A1712]'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

export default function StatsRow({ total, responseRate, ghostRate, medianDaysApplied }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label="Tracked" value={String(total)} />
      <Stat label="Response rate" value={`${responseRate}%`} accent />
      <Stat label="Ghost rate" value={`${ghostRate}%`} />
      <Stat label="Median days in Applied" value={String(medianDaysApplied)} />
    </div>
  )
}
