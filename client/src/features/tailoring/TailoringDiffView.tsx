import { useState, useRef } from 'react'
import { readCsrf } from '../../lib/api'
import type { TailoringProposal } from '../../lib/types'

interface Decision {
  blockId: string
  content: string   // final content to include
  include: boolean  // false = rejected/excluded
}

interface TailoringDiffViewProps {
  applicationId: string
  onVersionCreated?: (resumeVersionId: string) => void
}

export default function TailoringDiffView({ applicationId, onVersionCreated }: TailoringDiffViewProps) {
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
    let accumulated = ''

    try {
      const res = await fetch(`/api/v1/applications/${applicationId}/tailor`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': readCsrf() ?? '', 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const parts = accumulated.split('\n\n')
        accumulated = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const evt = JSON.parse(part.slice(6))
          if (evt.type === 'result') {
            setProposals(evt.data.proposals ?? [])
          } else if (evt.type === 'error') {
            setError(evt.message)
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setStreaming(false)
    }
  }

  function accept(p: TailoringProposal) {
    const content = p.action === 'rewrite' ? (p.rewrittenContent ?? '') : (p.originalContent ?? '')
    setDecisions((d) => ({ ...d, [p.blockId]: { blockId: p.blockId, content, include: true } }))
    setEditingId(null)
  }

  function reject(p: TailoringProposal) {
    setDecisions((d) => ({ ...d, [p.blockId]: { blockId: p.blockId, content: '', include: false } }))
    setEditingId(null)
  }

  function startEdit(p: TailoringProposal) {
    const content = p.action === 'rewrite' ? (p.rewrittenContent ?? '') : (p.originalContent ?? '')
    setEditContent(content)
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
      const res = await fetch(`/api/v1/applications/${applicationId}/resume-version`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': readCsrf() ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBlocks }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { resumeVersionId } = await res.json()
      onVersionCreated?.(resumeVersionId)
      setPdfStatus('polling')
      pollRef.current = setInterval(async () => {
        const pRes = await fetch(`/api/v1/resume-versions/${resumeVersionId}/pdf`, {
          credentials: 'include',
        })
        if (pRes.status === 200) {
          const { url } = await pRes.json()
          setPdfUrl(url)
          setPdfStatus('ready')
          if (pollRef.current) clearInterval(pollRef.current)
        }
      }, 2000)
    } catch (e: unknown) {
      setPdfStatus('error')
      setError(e instanceof Error ? e.message : 'PDF generation failed')
    }
  }

  const actionColor: Record<string, string> = {
    include: 'bg-blue-100 text-blue-700',
    exclude: 'bg-gray-100 text-gray-500',
    rewrite: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Resume Tailoring</h3>
        <button
          onClick={runTailoring}
          disabled={streaming}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {streaming ? 'Generating…' : proposals.length ? 'Regenerate' : 'Generate Proposals'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {proposals.length > 0 && (
        <>
          <div className="text-sm text-gray-500">
            {decided} / {proposals.length} decisions made
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all"
              style={{ width: `${proposals.length ? (decided / proposals.length) * 100 : 0}%` }}
            />
          </div>

          <div className="space-y-3">
            {proposals.map((p) => {
              const dec = decisions[p.blockId]
              const isEditing = editingId === p.blockId
              const proposed = p.action === 'rewrite' ? p.rewrittenContent : p.originalContent

              return (
                <div key={p.blockId} className={`border rounded-lg p-4 ${dec ? (dec.include ? 'border-green-300 bg-green-50' : 'border-red-200 bg-red-50 opacity-60') : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColor[p.action]}`}>
                      {p.action.toUpperCase()}
                    </span>
                    {!dec && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => accept(p)} className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Accept</button>
                        <button onClick={() => startEdit(p)} className="text-xs px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600">Edit</button>
                        <button onClick={() => reject(p)} className="text-xs px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500">Reject</button>
                      </div>
                    )}
                  </div>

                  {p.action === 'rewrite' && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Original</p>
                      <p className="text-sm text-gray-500 line-through">{p.originalContent}</p>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        className="w-full text-sm border rounded p-2 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(p)} className="text-xs px-3 py-1 bg-green-600 text-white rounded">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1 bg-gray-300 rounded">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{proposed}</p>
                  )}

                  <p className="text-xs text-gray-400 mt-2 italic">{p.reason}</p>
                </div>
              )
            })}
          </div>

          <button
            onClick={generatePdf}
            disabled={!allDecided || pdfStatus === 'creating' || pdfStatus === 'polling'}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pdfStatus === 'polling' ? 'Rendering PDF…' : pdfStatus === 'creating' ? 'Saving…' : 'Generate PDF'}
          </button>

          {pdfStatus === 'ready' && pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm text-indigo-600 underline"
            >
              Download PDF
            </a>
          )}
        </>
      )}
    </div>
  )
}
