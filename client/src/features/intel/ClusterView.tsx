import type { ClusterResponse } from '../../lib/types'

interface ClusterViewProps {
  data: ClusterResponse
  onSelectApp?: (id: string) => void
}

export default function ClusterView({ data, onSelectApp }: ClusterViewProps) {
  if (data.length === 0) {
    return (
      <div className="press !shadow-hard p-6 bg-paper-3 border-[1.5px] border-line text-center">
        <p className="font-mono text-xs text-ink-faint">No clusters detected yet. Try saving more diverse roles.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.map((cluster, idx) => (
        <div
          key={idx}
          className="press !shadow-hard p-5 bg-paper-3 border-[1.5px] border-line flex flex-col justify-between"
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <span className="font-display text-sm font-black text-ink uppercase tracking-wider truncate max-w-[70%]">
                {cluster.label}
              </span>
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-[#3A6B8E] text-paper-3 border-[1.5px] border-line px-2 py-0.5 shrink-0">
                {cluster.size} {cluster.size === 1 ? 'role' : 'roles'}
              </span>
            </div>

            {/* Cluster Skill Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {cluster.skills.map((skill) => (
                <span
                  key={skill}
                  className="font-mono text-[9px] font-medium border-[1.5px] border-line bg-paper-3 px-1.5 py-0.5 text-ink"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* List of Apps in Cluster */}
          <div className="border-t-[1.5px] border-line pt-3 space-y-1.5">
            <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">Jobs in this cluster</p>
            <div className="max-h-[140px] overflow-y-auto pr-1 space-y-1">
              {cluster.applications.map((app) => (
                <button
                  key={app.id}
                  onClick={() => onSelectApp?.(app.id)}
                  className="w-full text-left font-mono text-[10px] text-ink hover:text-signal truncate block"
                >
                  <span className="font-bold">{app.company}</span>
                  <span className="text-ink-soft ml-1.5">— {app.roleTitle}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
