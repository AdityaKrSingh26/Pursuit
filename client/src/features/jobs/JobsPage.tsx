import { useEffect } from 'react'
import { useDiscoveredJobs, useJobScanStatus, useRefreshJobs, useScoreJobs } from '../../lib/queries'
import { Button } from '../../components/ui'
import type { DiscoveredJob } from '../../lib/types'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ago`
  return `${m}m ago`
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-signal' : score >= 50 ? 'bg-ink-soft' : 'bg-ink-faint'
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 font-mono text-[13px] font-semibold tabular-nums text-ink">{score}</span>
      <div className="h-1 w-16 overflow-hidden bg-line/20">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function JobRow({ job }: { job: DiscoveredJob }) {
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 border-b border-line/40 px-5 py-4 transition-colors hover:bg-paper-2"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="font-sans text-[13px] font-semibold text-ink">{job.company}</span>
          <span className="text-ink-faint">·</span>
          <span className="font-sans text-[13px] text-ink">{job.title}</span>
          {job.location && (
            <>
              <span className="text-ink-faint">·</span>
              <span className="font-mono text-[11px] text-ink-soft">{job.location}</span>
            </>
          )}
        </div>
        {job.techStack.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {job.techStack.slice(0, 6).map((t) => (
              <span key={t} className="border border-line/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-soft">
                {t}
              </span>
            ))}
          </div>
        )}
        {job.scoreReason && (
          <p className="mt-1 font-sans text-[12px] text-ink-soft">{job.scoreReason}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {job.score !== null ? (
          <ScoreBar score={job.score} />
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">unscored</span>
        )}
        <span className="font-mono text-[10px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">→</span>
      </div>
    </a>
  )
}

export default function JobsPage() {
  const { data, isLoading } = useDiscoveredJobs()
  const { data: scanStatus } = useJobScanStatus()
  const refresh = useRefreshJobs()
  const score = useScoreJobs()

  const isScanning = scanStatus?.status === 'running' || scanStatus?.status === 'queued'
  const isScoring = score.isPending

  // Poll jobs when scan completes
  useEffect(() => {
    if (scanStatus?.status === 'idle' && refresh.isSuccess) {
      // scan just finished, jobs query will refetch via invalidation
    }
  }, [scanStatus?.status, refresh.isSuccess])

  const jobs = data?.jobs ?? []
  const sortedJobs = [...jobs].sort((a, b) => {
    if (a.score !== null && b.score !== null) return b.score - a.score
    if (a.score !== null) return -1
    if (b.score !== null) return 1
    return new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
  })

  const unscoredCount = jobs.filter((j) => j.score === null).length
  const lastScanAt = data?.lastScanAt ?? scanStatus?.lastScanAt

  return (
    <div className="flex h-full flex-col overflow-hidden bg-paper">
      {/* Header */}
      <div className="border-b-[1.5px] border-line px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Discover</h1>
            <p className="label mt-1">
              {lastScanAt
                ? `last scanned ${timeAgo(lastScanAt)} · ${data?.total ?? 0} jobs`
                : 'no scan yet'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={unscoredCount > 0 ? 'signal' : 'ghost'}
              disabled={isScoring || isScanning || jobs.length === 0}
              onClick={() => score.mutate()}
            >
              {isScoring ? 'SCORING…' : unscoredCount > 0 ? `SCORE FOR RELEVANCE (${unscoredCount})` : 'RE-SCORE'}
            </Button>

            <Button
              variant={isScanning ? 'ghost' : 'default'}
              disabled={isScanning}
              onClick={() => refresh.mutate()}
            >
              {isScanning
                ? `SCANNING… ${scanStatus?.progress ?? 0}%`
                : lastScanAt
                ? `↻ REFRESH`
                : '↻ FETCH JOBS'}
            </Button>
          </div>
        </div>
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <span className="label animate-pulse">Loading…</span>
          </div>
        ) : sortedJobs.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">No jobs discovered yet</p>
            <p className="font-sans text-[13px] text-ink-soft">
              Click <span className="font-mono text-[11px] uppercase tracking-wider">↻ Fetch Jobs</span> to scan 130+ companies
            </p>
          </div>
        ) : (
          sortedJobs.map((job) => <JobRow key={job.id} job={job} />)
        )}
      </div>
    </div>
  )
}
