import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui'
import { streamAnalysis } from '../../lib/sse'
import { ApiError } from '../../lib/api'
import { useLatestAnalysis } from '../../lib/queries'
import type { PrepQuestion, PrepResult } from '../../lib/types'

type Group = 'technicalQuestions' | 'behavioralQuestions' | 'gapProbes'
const GROUPS: { key: Group; label: string }[] = [
  { key: 'technicalQuestions', label: 'Technical' },
  { key: 'behavioralQuestions', label: 'Behavioral' },
  { key: 'gapProbes', label: 'Gap probes' },
]

function QuestionItem({ q }: { q: PrepQuestion }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-[1.5px] border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-paper-3"
      >
        <span className="font-mono text-signal">{open ? '−' : '+'}</span>
        <span className="flex-1">{q.text}</span>
      </button>
      {open && (
        <p className="border-t border-line/40 bg-paper-3 px-3 py-2 text-[13px] text-ink-soft">
          <span className="label mr-1.5">why</span>
          {q.reason}
        </p>
      )}
    </div>
  )
}

export default function PrepTab({ appId, parsed }: { appId: string; parsed: boolean }) {
  const qc = useQueryClient()
  const cached = useLatestAnalysis(appId, 'PREP')
  const [streaming, setStreaming] = useState(false)
  const [result, setResult] = useState<PrepResult | null>(null)
  const [tab, setTab] = useState<Group>('technicalQuestions')
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)

  const view = result ?? ((cached.data?.result as PrepResult | undefined) ?? null)

  async function run() {
    setStreaming(true)
    setError(null)
    setRateLimited(false)
    setResult(null)
    try {
      await streamAnalysis<PrepResult>(`/applications/${appId}/analysis/prep`, (ev) => {
        if (ev.type === 'result') setResult(ev.data)
        else if (ev.type === 'error') setError(ev.message)
      })
      qc.invalidateQueries({ queryKey: ['analysis', appId, 'PREP'] })
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setRateLimited(true)
        setError(err.message)
      } else {
        setError(err instanceof ApiError ? err.message : 'Prep generation failed.')
      }
    } finally {
      setStreaming(false)
    }
  }

  if (!parsed) {
    return (
      <p className="border-l-2 border-partial bg-partial/10 px-3 py-2 font-mono text-[11px] text-partial">
        The job description must finish parsing before interview prep can run.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          Company-specific questions from the JD and your resume. Max 3 / day.
        </p>
        <Button variant="signal" onClick={run} disabled={streaming || rateLimited}>
          {streaming ? 'Generating…' : view ? '↻ Regenerate' : 'Generate prep →'}
        </Button>
      </div>

      {error && (
        <p className="border-l-2 border-missing bg-missing/10 px-3 py-2 font-mono text-[11px] text-missing">
          {error}
        </p>
      )}

      {view && (
        <>
          {view.companyAngle && (
            <div className="border-l-2 border-signal bg-signal/5 px-3 py-2">
              <p className="label mb-1">Company angle</p>
              <p className="text-sm">{view.companyAngle}</p>
            </div>
          )}

          <div className="flex gap-px border-[1.5px] border-line bg-line">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setTab(g.key)}
                className={`flex-1 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors ${
                  tab === g.key ? 'bg-ink text-paper-3' : 'bg-paper-3 text-ink-soft hover:bg-paper'
                }`}
              >
                {g.label} · {view[g.key].length}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {view[tab].map((q, i) => (
              <QuestionItem key={i} q={q} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
