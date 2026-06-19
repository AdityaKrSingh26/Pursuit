import { useSimilarJobs } from '../../lib/queries'

interface SimilarJobsSidebarProps {
  appId: string
  onSelectApp?: (id: string) => void
}

export default function SimilarJobsSidebar({ appId, onSelectApp }: SimilarJobsSidebarProps) {
  const { data: similar, isLoading } = useSimilarJobs(appId)

  if (isLoading) {
    return (
      <div className="mt-4 border-t-[1.5px] border-line pt-4">
        <p className="label mb-2">Similar Applications</p>
        <p className="font-mono text-[10px] text-ink-faint">Finding matches…</p>
      </div>
    )
  }

  if (!similar || similar.length === 0) {
    return null
  }

  return (
    <div className="mt-4 border-t-[1.5px] border-line pt-4">
      <p className="label mb-2.5">Similar Applications</p>
      <div className="space-y-2">
        {similar.map((item) => {
          const similarityPct = Math.round(item.similarity * 100)
          
          // Color coding based on similarity score
          let chipColors = 'bg-paper-3 text-ink-soft border-line'
          if (similarityPct >= 80) {
            chipColors = 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]'
          } else if (similarityPct >= 60) {
            chipColors = 'bg-[#9A6A1F]/10 text-[#9A6A1F] border-[#9A6A1F]'
          }

          return (
            <button
              key={item.id}
              onClick={() => onSelectApp?.(item.id)}
              className="w-full flex items-center justify-between p-2 border-1.5 border-line bg-paper hover:bg-paper-3 text-left transition-colors"
            >
              <div className="min-w-0 pr-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft block truncate">
                  {item.company}
                </span>
                <span className="font-display text-xs font-bold text-ink block truncate">
                  {item.roleTitle}
                </span>
              </div>
              <span className={`font-mono text-[9px] font-bold border px-1.5 py-0.5 shrink-0 ${chipColors}`}>
                {similarityPct}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
