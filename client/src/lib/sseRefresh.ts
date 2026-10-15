import { tryRefresh } from './api'

export async function fetchWith401Refresh(
  doFetch: () => Promise<Response>,
  onLoggedOut: () => void | Promise<void>,
): Promise<Response> {
  const res = await doFetch()
  if (res.status !== 401) return res
  const refreshed = await tryRefresh()
  if (refreshed) return doFetch()
  await onLoggedOut()
  return res
}
