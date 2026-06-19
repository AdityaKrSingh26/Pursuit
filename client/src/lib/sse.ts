import { BASE, readCsrf, ApiError } from './api'
import type { SSEEvent } from './types'

// POST-initiated SSE: EventSource only does GET, so we stream the fetch body
// and split on the SSE record boundary ("\n\n"), parsing each `data:` line.
export async function streamAnalysis<T>(
  path: string,
  onEvent: (ev: SSEEvent<T>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  const csrf = readCsrf()
  if (csrf) headers.set('x-csrf-token', csrf)

  const res = await fetch(BASE + path, {
    method: 'POST',
    headers,
    credentials: 'include',
    signal,
  })

  if (!res.ok) {
    let code = 'ERROR'
    let message = 'Analysis request failed'
    try {
      const body = await res.json()
      code = body?.error?.code ?? code
      message = body?.error?.message ?? message
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code, message)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let boundary: number
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const record = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      for (const line of record.split('\n')) {
        const trimmed = line.trimStart()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload) continue
        try {
          onEvent(JSON.parse(payload) as SSEEvent<T>)
        } catch {
          /* skip malformed chunk */
        }
      }
    }
  }
}
