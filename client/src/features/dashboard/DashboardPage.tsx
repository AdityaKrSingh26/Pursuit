import { useEffect, useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PageHeader from '../../components/PageHeader'
import { EmptyState, Spinner } from '../../components/ui'
import { useInfiniteApplications } from '../../lib/queries'
import { FUNNEL_STAGES, stageMeta } from '../../lib/stages'
import type { Application, Stage } from '../../lib/types'

const INK = '#1A1712'
const SIGNAL = '#DD4814'

function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function computeStats(apps: Application[]) {
  const counts = Object.fromEntries(
    FUNNEL_STAGES.map((s) => [s, 0]),
  ) as Record<Stage, number>
  // A stage is "reached" if the app is there now or moved past it.
  const reached = Object.fromEntries(FUNNEL_STAGES.map((s) => [s, 0])) as Record<Stage, number>
  const order = FUNNEL_STAGES

  for (const app of apps) {
    const visited = new Set<Stage>([app.stage])
    for (const ev of app.stageEvents) {
      visited.add(ev.toStage)
      if (ev.fromStage) visited.add(ev.fromStage)
    }
    order.forEach((s, i) => {
      const idxNow = order.indexOf(app.stage)
      if (visited.has(s) || (idxNow >= 0 && idxNow >= i)) reached[s]++
    })
    if (counts[app.stage] !== undefined) counts[app.stage]++
  }

  const funnel = order.map((s) => ({
    stage: stageMeta(s).label,
    code: s,
    reached: reached[s],
    swatch: stageMeta(s).swatch,
  }))

  // Velocity: applications created per week over the last 8 weeks.
  const weeks: { label: string; count: number }[] = []
  const now = Date.now()
  for (let w = 7; w >= 0; w--) {
    const start = now - (w + 1) * 7 * 86_400_000
    const end = now - w * 7 * 86_400_000
    const count = apps.filter((a) => {
      const t = new Date(a.createdAt).getTime()
      return t >= start && t < end
    }).length
    weeks.push({ label: `−${w}w`, count })
  }

  const total = apps.length
  const ghosted = apps.filter((a) => a.stage === 'GHOSTED').length
  const appliedPlus = reached['APPLIED']
  const respondedSet = apps.filter((a) =>
    a.stageEvents.some((e) => ['OA', 'TECH', 'HR', 'OFFER'].includes(e.toStage)),
  ).length
  const responseRate = appliedPlus ? Math.round((respondedSet / appliedPlus) * 100) : 0
  const ghostRate = total ? Math.round((ghosted / total) * 100) : 0

  // Median days spent in a stage, from consecutive stage events.
  const durations: number[] = []
  for (const app of apps) {
    const evs = [...app.stageEvents].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    )
    for (let i = 0; i < evs.length - 1; i++) {
      durations.push(
        (new Date(evs[i + 1].at).getTime() - new Date(evs[i].at).getTime()) / 86_400_000,
      )
    }
  }

  return {
    funnel,
    weeks,
    responseRate,
    ghostRate,
    medianDays: Math.round(median(durations)),
    total,
  }
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="press !shadow-hard-sm flex flex-col justify-between p-4">
      <span className="label">{label}</span>
      <span
        className={`mt-3 font-display text-4xl font-black leading-none ${accent ? 'text-signal' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteApplications({})

  // Pull every page so aggregate stats reflect the full search, not one page.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const apps = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])
  const stats = useMemo(() => computeStats(apps), [apps])

  return (
    <div className="flex h-full flex-col">
      <PageHeader index="03" title="Funnel" subtitle="Conversion and velocity across the whole search." />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <Spinner />
        ) : apps.length === 0 ? (
          <EmptyState title="No data yet" hint="Track a few applications and the funnel fills in." />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Tracked" value={String(stats.total)} />
              <Stat label="Response rate" value={`${stats.responseRate}%`} accent />
              <Stat label="Ghost rate" value={`${stats.ghostRate}%`} />
              <Stat label="Median days / stage" value={String(stats.medianDays)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="press !shadow-hard p-5">
                <p className="label mb-4">Stage conversion</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.funnel} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="#1A171214" vertical={false} />
                    <XAxis
                      dataKey="stage"
                      tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5C5446' }}
                      tickLine={false}
                      axisLine={{ stroke: INK }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5C5446' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#1A171210' }}
                      contentStyle={{
                        border: '1.5px solid #1A1712',
                        borderRadius: 0,
                        background: '#FBF8F0',
                        fontFamily: 'JetBrains Mono',
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="reached" name="reached" isAnimationActive>
                      {stats.funnel.map((d) => (
                        <Cell key={d.code} fill={d.swatch} stroke={INK} strokeWidth={1.5} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="press !shadow-hard p-5">
                <p className="label mb-4">Applications / week (last 8)</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={stats.weeks} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="#1A171214" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5C5446' }}
                      tickLine={false}
                      axisLine={{ stroke: INK }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontFamily: 'JetBrains Mono', fontSize: 10, fill: '#5C5446' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        border: '1.5px solid #1A1712',
                        borderRadius: 0,
                        background: '#FBF8F0',
                        fontFamily: 'JetBrains Mono',
                        fontSize: 11,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={SIGNAL}
                      strokeWidth={2.5}
                      dot={{ fill: INK, r: 3 }}
                      isAnimationActive
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
