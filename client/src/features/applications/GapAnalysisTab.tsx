import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui'
import { streamAnalysis } from '../../lib/sse'
import { ApiError } from '../../lib/api'
import { useLatestAnalysis } from '../../lib/queries'
import ScoreRing from './ScoreRing'
import type { GapAnalysis } from '../../lib/types'

function SkillRow({ title, skills, color }: { title: string; skills: string[]; color: string }) {
  if (!skills.length) return null
  return (
    <div>
      <p className="label mb-1.5">
        {title} · {skills.length}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <span
            key={s}
            className="border px-2 py-0.5 font-mono text-[11px]"
            style={{ borderColor: color, backgroundColor: color + '18', color }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function GapAnalysisTab({ appId, parsed }: { appId: string; parsed: boolean }) {
  const qc = useQueryClient()
  const cached = useLatestAnalysis(appId, 'GAP')
  const [streaming, setStreaming] = useState(false)
  const [summary, setSummary] = useState('')
  const [result, setResult] = useState<GapAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)

  const cachedResult = (cached.data?.result as GapAnalysis | undefined) ?? null
  const view = result ?? cachedResult

  useEffect(() => {
    summaryRef.current?.scrollTo({ top: summaryRef.current.scrollHeight })
  }, [summary])

  async function run() {
    setStreaming(true)
    setError(null)
    setSummary('')
    setResult(null)
    try {
      await streamAnalysis<GapAnalysis>(`/applications/${appId}/analysis/gap`, (ev) => {
        if (ev.type === 'token') setSummary((s) => s + ev.content)
        else if (ev.type === 'result') setResult(ev.data)
        else if (ev.type === 'error') setError(ev.message)
      })
      qc.invalidateQueries({ queryKey: ['analysis', appId, 'GAP'] })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Analysis failed.')
    } finally {
      setStreaming(false)
    }
  }

  if (!parsed) {
    return (
      <p className="border-l-2 border-partial bg-partial/10 px-3 py-2 font-mono text-[11px] text-partial">
        The job description must finish parsing before gap analysis can run.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          Compares the parsed JD against your resume blocks.
        </p>
        <Button variant="signal" onClick={run} disabled={streaming}>
          {streaming ? 'Analyzing…' : view ? '↻ Re-run' : 'Run analysis →'}
        </Button>
      </div>

      {error && (
        <p className="border-l-2 border-missing bg-missing/10 px-3 py-2 font-mono text-[11px] text-missing">
          {error}
        </p>
      )}

      {(streaming || summary || view) && (
        <div className="grid grid-cols-[1fr_auto] items-start gap-5">
          <div>
            <p className="label mb-1.5">Summary</p>
            <div
              ref={summaryRef}
              className="max-h-40 overflow-y-auto whitespace-pre-wrap border-[1.5px] border-line bg-paper-3 p-3 text-sm leading-relaxed"
            >
              {summary || view?.overallSummary || (
                <span className="text-ink-faint">Waiting for tokens…</span>
              )}
              {streaming && <span className="ml-0.5 inline-block animate-blink">▍</span>}
            </div>
          </div>
          {view && (
            <ScoreRing
              score={view.matchScore}
              skillOverlapPct={view.skillOverlapPct}
              llmRelevanceScore={view.llmRelevanceScore}
            />
          )}
        </div>
      )}

      {view && (
        <div className="space-y-4 border-t-[1.5px] border-line pt-4">
          <SkillRow title="Matched" skills={view.matchedSkills} color="#1F6B5C" />
          <SkillRow title="Partial" skills={view.partialSkills} color="#C08A1E" />
          <SkillRow title="Missing" skills={view.missingSkills} color="#C0392B" />

          {view.bulletRanking.length > 0 && (
            <div>
              <p className="label mb-1.5">Bullet ranking</p>
              <div className="border-[1.5px] border-line">
                {view.bulletRanking.map((b, i) => (
                  <div
                    key={b.blockId}
                    className={`grid grid-cols-[auto_1fr] gap-3 px-3 py-2 ${
                      i ? 'border-t border-line/40' : ''
                    }`}
                  >
                    <span className="font-display text-lg font-black tabular-nums text-signal">
                      {b.relevanceScore}
                    </span>
                    <span className="text-sm text-ink-soft">{b.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view.riskQuestions.length > 0 && (
            <div>
              <p className="label mb-1.5">Risk questions</p>
              <ul className="space-y-1.5">
                {view.riskQuestions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-missing">⚑</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
