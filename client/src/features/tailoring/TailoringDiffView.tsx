import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui'
import { api, ApiError } from '../../lib/api'
import { streamAnalysis } from '../../lib/sse'
import type { ResumeBlock, TailoringProposal, TailoringResult } from '../../lib/types'

interface Decision {
  blockId: string
  content: string
  include: boolean
}

const actionColor: Record<string, string> = {
  include: '#1F6B5C',
  exclude: '#8E8576',
  rewrite: '#C08A1E',
}

export default function TailoringDiffView({
  applicationId,
  onVersionCreated,
}: {
  applicationId: string
  onVersionCreated?: (resumeVersionId: string) => void
}) {
  const { data: blocks = [] } = useQuery<ResumeBlock[]>({
    queryKey: ['resume-blocks'],
    queryFn: () => api<ResumeBlock[]>('/resume/blocks'),
  })
  const blockContent = new Map(blocks.map((b) => [b.id, b.content]))

  const [proposals, setProposals] = useState<TailoringProposal[]>([])
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'creating' | 'polling' | 'ready' | 'error'>('idle')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function runTailoring() {
    setProposals([])
    setDecisions({})
    setStreaming(true)
    setError(null)

    try {
      await streamAnalysis<TailoringResult>(`/applications/${applicationId}/tailor`, (ev) => {
        if (ev.type === 'result') setProposals(ev.data.proposals ?? [])
        else if (ev.type === 'error') setError(ev.message)
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tailoring failed.')
    } finally {
      setStreaming(false)
    }
  }

  function originalOf(p: TailoringProposal) {
    return blockContent.get(p.blockId) ?? ''
  }

  function accept(p: TailoringProposal) {
    const content = p.action === 'rewrite' ? (p.rewrittenContent ?? '') : originalOf(p)
    setDecisions((d) => ({ ...d, [p.blockId]: { blockId: p.blockId, content, include: true } }))
    setEditingId(null)
  }

  function reject(p: TailoringProposal) {
    setDecisions((d) => ({ ...d, [p.blockId]: { blockId: p.blockId, content: '', include: false } }))
    setEditingId(null)
  }

  function startEdit(p: TailoringProposal) {
    setEditContent(p.action === 'rewrite' ? (p.rewrittenContent ?? '') : originalOf(p))
    setEditingId(p.blockId)
  }

  function saveEdit(p: TailoringProposal) {
    setDecisions((d) => ({ ...d, [p.blockId]: { blockId: p.blockId, content: editContent, include: true } }))
    setEditingId(null)
  }

  const decided = proposals.filter((p) => decisions[p.blockId] !== undefined).length
  const allDecided = proposals.length > 0 && decided === proposals.length

  async function generatePdf() {
    const approvedBlocks = proposals
      .filter((p) => decisions[p.blockId]?.include)
      .map((p) => ({ blockId: p.blockId, content: decisions[p.blockId].content }))

    setPdfStatus('creating')
    try {
      const { resumeVersionId } = await api<{ resumeVersionId: string }>(
        `/applications/${applicationId}/resume-version`,
        { method: 'POST', body: { approvedBlocks } },
      )
      onVersionCreated?.(resumeVersionId)
      setPdfStatus('polling')
      pollRef.current = setInterval(async () => {
        const res = await api<{ url?: string; status?: string }>(`/resume-versions/${resumeVersionId}/pdf`)
        if (res.url) {
          setPdfUrl(res.url)
          setPdfStatus('ready')
          if (pollRef.current) clearInterval(pollRef.current)
        }
      }, 2000)
    } catch (err) {
      setPdfStatus('error')
      setError(err instanceof ApiError ? err.message : 'PDF generation failed.')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          Proposes include/exclude/rewrite decisions per resume block against the parsed JD.
        </p>
        <Button variant="signal" onClick={runTailoring} disabled={streaming}>
          {streaming ? 'Generating…' : proposals.length ? '↻ Regenerate' : 'Generate proposals →'}
        </Button>
      </div>

      {error && (
        <p className="border-l-2 border-missing bg-missing/10 px-3 py-2 font-mono text-[11px] text-missing">
          {error}
        </p>
      )}

      {proposals.length > 0 && (
        <>
          <div>
            <p className="label mb-1.5">
              {decided} / {proposals.length} decisions made
            </p>
            <div className="h-1.5 w-full border-[1.5px] border-line bg-paper-3">
              <div
                className="h-full bg-signal transition-all"
                style={{ width: `${proposals.length ? (decided / proposals.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {proposals.map((p) => {
              const dec = decisions[p.blockId]
              const isEditing = editingId === p.blockId
              const proposed = p.action === 'rewrite' ? p.rewrittenContent : originalOf(p)
              const color = actionColor[p.action]

              return (
                <div
                  key={p.blockId}
                  className={`border-[1.5px] p-4 ${
                    dec
                      ? dec.include
                        ? 'border-matched bg-matched/10'
                        : 'border-missing bg-missing/10 opacity-60'
                      : 'border-line'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span
                      className="border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                      style={{ borderColor: color, backgroundColor: color + '18', color }}
                    >
                      {p.action}
                    </span>
                    {!dec && (
                      <div className="flex shrink-0 gap-2">
                        <Button variant="default" className="!px-2 !py-1" onClick={() => accept(p)}>
                          Accept
                        </Button>
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => startEdit(p)}>
                          Edit
                        </Button>
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => reject(p)}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>

                  {p.action === 'rewrite' && (
                    <div className="mb-2">
                      <p className="label mb-1">Original</p>
                      <p className="text-sm text-ink-faint line-through">{originalOf(p)}</p>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        className="field h-24 resize-none"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button variant="signal" className="!px-2 !py-1" onClick={() => saveEdit(p)}>
                          Save
                        </Button>
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{proposed}</p>
                  )}

                  <p className="mt-2 font-mono text-[10.5px] italic text-ink-faint">{p.reason}</p>
                </div>
              )
            })}
          </div>

          <Button
            variant="signal"
            className="w-full"
            disabled={!allDecided || pdfStatus === 'creating' || pdfStatus === 'polling'}
            onClick={generatePdf}
          >
            {pdfStatus === 'polling' ? 'Rendering PDF…' : pdfStatus === 'creating' ? 'Saving…' : 'Generate PDF'}
          </Button>

          {pdfStatus === 'ready' && pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center font-mono text-[11px] uppercase tracking-wider text-signal underline"
            >
              Download PDF
            </a>
          )}
        </>
      )}
    </div>
  )
}
