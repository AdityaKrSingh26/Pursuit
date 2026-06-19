import { useState } from 'react'
import { useJdStatus } from '../../lib/queries'
import { Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import type { ParseStatus } from '../../lib/types'

const LABELS: Record<ParseStatus, string> = {
  QUEUED: 'Queued',
  FETCHING: 'Fetching',
  PARSING: 'Parsing',
  DONE: 'Parsed',
  FAILED: 'Failed',
}

export default function ParseStatusBadge({
  jdId,
  onDone,
}: {
  jdId: string
  onDone?: () => void
}) {
  const { data } = useJdStatus(jdId, true)
  const [reparsing, setReparsing] = useState(false)
  const status = data?.parseStatus ?? 'QUEUED'

  if (status === 'DONE') {
    onDone?.()
    return (
      <span className="inline-flex items-center gap-1.5 border border-matched bg-matched/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-matched">
        ✓ Parsed
      </span>
    )
  }

  if (status === 'FAILED') {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 border border-missing bg-missing/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-missing">
          ✕ Failed
        </span>
        {data?.parseError && (
          <p className="font-mono text-[10px] text-ink-faint">{data.parseError}</p>
        )}
        <button
          disabled={reparsing}
          onClick={async () => {
            setReparsing(true)
            try {
              await api(`/jd/${jdId}/reparse`, { method: 'POST' })
            } finally {
              setReparsing(false)
            }
          }}
          className="block font-mono text-[10px] uppercase tracking-wider text-signal hover:underline"
        >
          ↻ Retry parse
        </button>
      </div>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 border border-line bg-paper-3 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
      <Spinner className="h-3 w-3" />
      {LABELS[status]}…
    </span>
  )
}
