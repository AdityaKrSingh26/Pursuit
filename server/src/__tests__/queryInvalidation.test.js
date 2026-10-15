import { describe, expect, it, vi } from 'vitest'
import { invalidateApplicationQueries } from '../../../client/src/lib/queryInvalidation.ts'

describe('invalidateApplicationQueries', () => {
  it('invalidates pipeline, ledger, and dashboard keys together', () => {
    const qc = { invalidateQueries: vi.fn() }
    invalidateApplicationQueries(qc)
    const keys = qc.invalidateQueries.mock.calls.map((c) => c[0].queryKey[0])
    expect(keys).toEqual([
      'applications',
      'applications-list',
      'dashboard-funnel',
      'dashboard-velocity',
    ])
  })
})
