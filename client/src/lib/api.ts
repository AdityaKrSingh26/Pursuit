const BASE = '/api/v1'

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function readCsrf(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

async function parseError(res: Response): Promise<ApiError> {
  let code = 'ERROR'
  let message = res.statusText || 'Request failed'
  try {
    const body = await res.json()
    if (body?.error) {
      code = body.error.code ?? code
      message = body.error.message ?? message
    }
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, code, message)
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown }

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const method = (opts.method ?? 'GET').toUpperCase()
  const headers = new Headers(opts.headers)

  if (opts.body !== undefined) headers.set('Content-Type', 'application/json')
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = readCsrf()
    if (csrf) headers.set('x-csrf-token', csrf)
  }

  const res = await fetch(BASE + path, {
    ...opts,
    method,
    headers,
    credentials: 'include',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const body = text ? JSON.parse(text) : undefined
  if (body && body.ok === true && 'data' in body) return body.data as T
  return body as T
}

export { readCsrf, BASE }
