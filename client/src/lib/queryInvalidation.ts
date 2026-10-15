import type { QueryClient } from '@tanstack/react-query'

export const APPLICATION_LIST_KEYS = ['applications', 'applications-list'] as const
export const DASHBOARD_KEYS = ['dashboard-funnel', 'dashboard-velocity'] as const

export function invalidateApplicationQueries(qc: QueryClient): void {
  for (const key of APPLICATION_LIST_KEYS) {
    qc.invalidateQueries({ queryKey: [key] })
  }
  for (const key of DASHBOARD_KEYS) {
    qc.invalidateQueries({ queryKey: [key] })
  }
}
