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

const NO_REFRESH_PATHS = ['/auth/refresh', '/auth/login', '/auth/register']

// Concurrent 401s share one refresh attempt instead of each firing their own.
let refreshPromise: Promise<boolean> | null = null

function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function api<T = unknown>(path: string, opts: Options = {}, _retried = false): Promise<T> {
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

  if (res.status === 401 && !_retried && !NO_REFRESH_PATHS.includes(path)) {
    const refreshed = await tryRefresh()
    if (refreshed) return api<T>(path, opts, true)
    const { useAuth } = await import('../stores/auth')
    useAuth.setState({ user: null, csrfToken: null })
  }

  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const body = text ? JSON.parse(text) : undefined
  if (body && body.ok === true && 'data' in body) return body.data as T
  return body as T
}

export async function apiUpload<T = unknown>(path: string, file: File, _retried = false): Promise<T> {
  const headers = new Headers()
  const csrf = readCsrf()
  if (csrf) headers.set('x-csrf-token', csrf)

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(BASE + path, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  })

  if (res.status === 401 && !_retried) {
    const refreshed = await tryRefresh()
    if (refreshed) return apiUpload<T>(path, file, true)
    const { useAuth } = await import('../stores/auth')
    useAuth.setState({ user: null, csrfToken: null })
  }

  if (!res.ok) throw await parseError(res)
  const text = await res.text()
  const body = text ? JSON.parse(text) : undefined
  if (body && body.ok === true && 'data' in body) return body.data as T
  return body as T
}

export { readCsrf, BASE }
