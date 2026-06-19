import { useEffect, useState } from 'react'
import {
  useApplication,
  useDeleteApplication,
  usePatchApplication,
  useStageHistory,
} from '../../lib/queries'
import { STAGES, stageMeta } from '../../lib/stages'
import { Spinner, StageBadge, Tag } from '../../components/ui'
import { fmtDate, fmtDateTime } from '../../lib/format'
import ParseStatusBadge from './ParseStatusBadge'
import GapAnalysisTab from './GapAnalysisTab'
import PrepTab from './PrepTab'
import SimilarJobsSidebar from '../intel/SimilarJobsSidebar'
import type { Stage } from '../../lib/types'

type Tab = 'overview' | 'timeline' | 'gap' | 'prep'
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'gap', label: 'Gap analysis' },
  { key: 'prep', label: 'Interview prep' },
]

export default function DetailDrawer({
  id,
  onClose,
  onSelectApp,
}: {
  id: string
  onClose: () => void
  onSelectApp?: (id: string) => void
}) {
  const { data: app, isLoading } = useApplication(id)
  const history = useStageHistory(id)
  const patch = usePatchApplication()
  const del = useDeleteApplication()
  const [tab, setTab] = useState<Tab>('overview')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const jd = app?.jd
  const parsed = jd?.parseStatus === 'DONE'
  const structured = jd?.structured

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        className="flex h-full w-full max-w-2xl animate-rise-in flex-col border-l-[1.5px] border-line bg-paper-2 shadow-hard-lg"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ animationDuration: '0.3s' }}
      >
        {isLoading || !app ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <header className="border-b-[1.5px] border-line bg-paper px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="label">{app.company}</span>
                  <h2 className="font-display text-2xl font-black leading-tight">
                    {app.roleTitle}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="font-mono text-xl leading-none text-ink-soft hover:text-signal"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={app.stage}
                  onChange={(e) =>
                    patch.mutate({ id, patch: { stage: e.target.value as Stage } })
                  }
                  className="border-[1.5px] border-line bg-paper-3 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em]"
                  style={{ color: stageMeta(app.stage).swatch }}
                >
                  {STAGES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {app.source && <Tag>{app.source}</Tag>}
                {jd && jd.parseStatus !== 'DONE' && <ParseStatusBadge jdId={jd.id} />}
                <span className="ml-auto font-mono text-[10px] text-ink-faint">
                  added {fmtDate(app.createdAt)}
                </span>
              </div>
            </header>

            <nav className="flex gap-px border-b-[1.5px] border-line bg-line">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors ${
                    tab === t.key ? 'bg-paper-2 text-ink' : 'bg-paper text-ink-soft hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="flex-1 overflow-y-auto p-6">
              {tab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Next action">
                      <input
                        type="date"
                        defaultValue={app.nextActionAt?.slice(0, 10) ?? ''}
                        onChange={(e) =>
                          patch.mutate({
                            id,
                            patch: {
                              nextActionAt: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                            },
                          })
                        }
                        className="field"
                      />
                    </Field>
                    {structured?.salaryText && (
                      <Field label="Salary">
                        <p className="text-sm">{structured.salaryText}</p>
                      </Field>
                    )}
                  </div>

                  <div>
                    <p className="label mb-1.5">Notes</p>
                    <textarea
                      defaultValue={app.notes ?? ''}
                      onBlur={(e) => patch.mutate({ id, patch: { notes: e.target.value } })}
                      placeholder="Markdown notes — saved on blur."
                      className="field min-h-[90px] resize-y"
                    />
                  </div>

                  {structured ? (
                    <div className="space-y-4 border-t-[1.5px] border-line pt-4">
                      <div className="flex flex-wrap gap-4 text-sm">
                        {structured.location && (
                          <span>
                            <span className="label mr-1">loc</span>
                            {structured.location}
                          </span>
                        )}
                        {(structured.yoeMin != null || structured.yoeMax != null) && (
                          <span>
                            <span className="label mr-1">yoe</span>
                            {structured.yoeMin ?? '?'}–{structured.yoeMax ?? '?'}
                          </span>
                        )}
                        {structured.employmentType && (
                          <span>
                            <span className="label mr-1">type</span>
                            {structured.employmentType}
                          </span>
                        )}
                      </div>

                      {structured.skills.length > 0 && (
                        <div>
                          <p className="label mb-1.5">Required skills</p>
                          <div className="flex flex-wrap gap-1.5">
                            {structured.skills.map((s) => (
                              <Tag key={s}>{s}</Tag>
                            ))}
                          </div>
                        </div>
                      )}
                      {structured.niceToHave.length > 0 && (
                        <div>
                          <p className="label mb-1.5">Nice to have</p>
                          <div className="flex flex-wrap gap-1.5">
                            {structured.niceToHave.map((s) => (
                              <Tag key={s}>{s}</Tag>
                            ))}
                          </div>
                        </div>
                      )}
                      {structured.responsibilities.length > 0 && (
                        <div>
                          <p className="label mb-1.5">Responsibilities</p>
                          <ul className="space-y-1 text-sm">
                            {structured.responsibilities.map((r, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-signal">›</span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="border-t-[1.5px] border-line pt-4 font-mono text-[11px] text-ink-faint">
                      No structured job description yet.
                    </p>
                  )}

                  <SimilarJobsSidebar appId={id} onSelectApp={onSelectApp} />

                  <div className="border-t-[1.5px] border-line pt-4">
                    {confirmDelete ? (
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-missing">Delete this application?</span>
                        <button
                          onClick={() => del.mutate(id, { onSuccess: onClose })}
                          className="border border-missing px-2 py-1 uppercase tracking-wider text-missing hover:bg-missing hover:text-paper-3"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="text-ink-soft hover:text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint hover:text-missing"
                      >
                        ✕ Delete application
                      </button>
                    )}
                  </div>
                </div>
              )}

              {tab === 'timeline' && (
                <div>
                  {history.isLoading ? (
                    <Spinner />
                  ) : (
                    <ol className="relative ml-2 border-l-[1.5px] border-line">
                      {(history.data ?? []).map((ev) => (
                        <li key={ev.id} className="relative mb-5 pl-5">
                          <span
                            className="absolute -left-[7px] top-1 h-3 w-3 border border-line"
                            style={{ backgroundColor: stageMeta(ev.toStage).swatch }}
                          />
                          <div className="flex items-center gap-2">
                            {ev.fromStage && (
                              <>
                                <StageBadge stage={ev.fromStage} />
                                <span className="text-ink-faint">→</span>
                              </>
                            )}
                            <StageBadge stage={ev.toStage} />
                          </div>
                          <p className="mt-1 font-mono text-[10px] text-ink-faint">
                            {fmtDateTime(ev.at)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {tab === 'gap' && <GapAnalysisTab appId={id} parsed={parsed} />}
              {tab === 'prep' && <PrepTab appId={id} parsed={parsed} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-1.5">{label}</p>
      {children}
    </div>
  )
}
