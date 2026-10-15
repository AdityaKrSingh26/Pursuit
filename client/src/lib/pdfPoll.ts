export const PDF_POLL_TIMEOUT_MS = 30_000

export type PdfPollDecision = 'ready' | 'failed' | 'timeout' | 'continue'

export function decidePdfPoll(
  payload: { url?: string; status?: string; error?: unknown },
  elapsedMs: number,
): PdfPollDecision {
  if (elapsedMs >= PDF_POLL_TIMEOUT_MS) return 'timeout'
  if (payload.error || payload.status === 'failed') return 'failed'
  if (payload.url) return 'ready'
  return 'continue'
}
