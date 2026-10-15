import { STAGES } from './stages'
import type { Application, Stage } from './types'

export interface AppFilters {
  stages?: Stage[]
  q?: string
  from?: string
  to?: string
}

export function buildApplicationsQuery(filters: AppFilters = {}, cursor?: string): string {
  const p = new URLSearchParams()
  // The list endpoint takes a single stage; multi-select filtering for the
  // table is applied client-side after fetch (see ListPage).
  if (filters.stages?.length === 1) p.set('stage', filters.stages[0])
  if (filters.q) p.set('q', filters.q)
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  if (cursor) p.set('cursor', cursor)
  p.set('limit', '50')
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function kanbanColumnFilters(): AppFilters[] {
  return STAGES.map((s) => ({ stages: [s.code] }))
}

export function moveApplicationAcrossStageLists(
  lists: Partial<Record<Stage, Application[]>>,
  id: string,
  from: Stage,
  to: Stage,
): Partial<Record<Stage, Application[]>> {
  const card = lists[from]?.find((a) => a.id === id)
  if (!card) return lists
  const moved = { ...card, stage: to }
  return {
    ...lists,
    [from]: (lists[from] ?? []).filter((a) => a.id !== id),
    [to]: [moved, ...(lists[to] ?? []).filter((a) => a.id !== id)],
  }
}
