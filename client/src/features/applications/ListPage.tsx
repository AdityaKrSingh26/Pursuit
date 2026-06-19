import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/PageHeader'
import { Button, EmptyState, Spinner, StageBadge } from '../../components/ui'
import { STAGES } from '../../lib/stages'
import { useInfiniteApplications, type AppFilters } from '../../lib/queries'
import { fmtDate, isPastDue } from '../../lib/format'
import type { Stage } from '../../lib/types'
import DetailDrawer from './DetailDrawer'

export default function ListPage() {
  const [stages, setStages] = useState<Stage[]>([])
  const [rawQuery, setRawQuery] = useState('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  // Debounce the search box so each keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => setQ(rawQuery.trim()), 350)
    return () => clearTimeout(t)
  }, [rawQuery])

  const filters: AppFilters = useMemo(
    () => ({
      // Server takes one stage; if exactly one chip is active we push it down,
      // otherwise we filter the fetched set client-side.
      stages: stages.length === 1 ? stages : undefined,
      q: q || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    }),
    [stages, q, from, to],
  )

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteApplications(filters)

  const rows = useMemo(() => {
    const all = data?.pages.flatMap((p) => p.items) ?? []
    return stages.length > 1 ? all.filter((a) => stages.includes(a.stage)) : all
  }, [data, stages])

  function toggleStage(s: Stage) {
    setStages((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader index="02" title="Ledger" subtitle="Every application, searchable and filterable." />

      <div className="space-y-3 border-b-[1.5px] border-line bg-paper px-8 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Search company, role, notes…"
            className="field max-w-xs"
          />
          <div className="flex items-center gap-1.5">
            <span className="label">from</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field !w-auto" />
            <span className="label">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field !w-auto" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => {
            const active = stages.includes(s.code)
            return (
              <button
                key={s.code}
                onClick={() => toggleStage(s.code)}
                className={`border-[1.5px] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-all ${
                  active ? 'border-line bg-ink text-paper-3' : 'border-line/40 text-ink-soft hover:border-line'
                }`}
              >
                {s.label}
              </button>
            )
          })}
          {stages.length > 0 && (
            <button onClick={() => setStages([])} className="px-2 font-mono text-[10px] uppercase tracking-wider text-signal hover:underline">
              clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5">
        {isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing matches" hint="Adjust the filters or add applications from the Pipeline." />
        ) : (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-[1.5px] border-line text-left">
                  {['Company', 'Role', 'Stage', 'Added', 'Next action'].map((h) => (
                    <th key={h} className="label py-2 pr-4 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setOpenId(a.id)}
                    className="cursor-pointer border-b border-line/30 transition-colors hover:bg-paper-3"
                  >
                    <td className="py-2.5 pr-4 font-semibold">{a.company}</td>
                    <td className="py-2.5 pr-4 text-sm text-ink-soft">{a.roleTitle}</td>
                    <td className="py-2.5 pr-4">
                      <StageBadge stage={a.stage} />
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[11px] text-ink-faint">
                      {fmtDate(a.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[11px]">
                      {a.nextActionAt ? (
                        <span className={isPastDue(a.nextActionAt) ? 'text-missing' : 'text-ink-soft'}>
                          {isPastDue(a.nextActionAt) && '⚑ '}
                          {fmtDate(a.nextActionAt)}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {hasNextPage && (
              <div className="mt-5 flex justify-center">
                <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? 'Loading…' : 'Load more ↓'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {openId && <DetailDrawer id={openId} onClose={() => setOpenId(null)} onSelectApp={(id) => setOpenId(id)} />}
    </div>
  )
}
