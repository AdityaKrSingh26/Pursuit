import { describe, expect, it } from 'vitest'
import {
  buildApplicationsQuery,
  kanbanColumnFilters,
  moveApplicationAcrossStageLists,
} from '../../../client/src/lib/kanbanBoard.ts'
import { STAGES } from '../../../client/src/lib/stages.ts'

describe('kanban board fetch', () => {
  it('builds one stage-scoped query per column so 50 SAVED cards cannot hide APPLIED', () => {
    const filters = kanbanColumnFilters()
    expect(filters).toHaveLength(STAGES.length)
    expect(filters.every((f) => f.stages?.length === 1)).toBe(true)

    const applied = filters.find((f) => f.stages?.[0] === 'APPLIED')
    expect(applied).toEqual({ stages: ['APPLIED'] })
    expect(buildApplicationsQuery(applied)).toContain('stage=APPLIED')
    expect(buildApplicationsQuery(applied)).toContain('limit=50')
    expect(buildApplicationsQuery({})).not.toMatch(/stage=/)
  })

  it('moves a card between per-stage lists so optimistic drag does not leave it in the old column', () => {
    const card = { id: 'a1', stage: 'SAVED', company: 'Acme', roleTitle: 'Eng' }
    const next = moveApplicationAcrossStageLists(
      { SAVED: [card], APPLIED: [] },
      'a1',
      'SAVED',
      'APPLIED',
    )
    expect(next.SAVED).toEqual([])
    expect(next.APPLIED).toEqual([{ ...card, stage: 'APPLIED' }])
  })
})
