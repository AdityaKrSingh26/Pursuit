import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db.js', () => ({
  prisma: {
    application: { groupBy: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('../lib/cache.js', () => ({
  cached: (_key, _ttl, fn) => fn(),
  CacheKey: {
    funnelStats: (userId) => `dashboard:funnel:${userId}`,
  },
}))

import { prisma } from '../lib/db.js'
import { getFunnel } from '../modules/dashboard/dashboard.service.js'
import { FUNNEL_CHART_TITLE, FUNNEL_PAGE_SUBTITLE } from '../../../client/src/lib/funnelCopy.ts'

describe('getFunnel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts live applications so a delete is visible before the matview refresh', async () => {
    prisma.application.groupBy.mockResolvedValue([
      { stage: 'SAVED', _count: { _all: 2 } },
      { stage: 'APPLIED', _count: { _all: 1 } },
    ])

    const result = await getFunnel('user-1')

    expect(prisma.application.groupBy).toHaveBeenCalledWith({
      by: ['stage'],
      where: { userId: 'user-1', deletedAt: null },
      _count: { _all: true },
    })
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(result.stageCounts.SAVED).toBe(2)
    expect(result.stageCounts.APPLIED).toBe(1)
    expect(result.total).toBe(3)
    // Occupancy mix: APPLIED / SAVED current counts, not path conversion.
    expect(result.conversionRates.APPLIED).toBe(50)
  })
})

describe('funnel copy', () => {
  it('names the chart occupancy rather than conversion', () => {
    expect(FUNNEL_CHART_TITLE.toLowerCase()).toContain('occupancy')
    expect(FUNNEL_PAGE_SUBTITLE.toLowerCase()).not.toContain('conversion')
  })
})
