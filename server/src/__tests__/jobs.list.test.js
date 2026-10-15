import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db.js', () => ({
  prisma: {
    discoveredJob: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('../lib/llm.js', () => ({ chat: vi.fn() }))

import { prisma } from '../lib/db.js'
import { listJobs } from '../modules/jobs/jobs.service.js'

function row(id) {
  return {
    id,
    company: 'Acme',
    title: 'Engineer',
    url: `https://jobs.example/${id}`,
    location: null,
    fetchedAt: new Date('2026-10-15T00:00:00.000Z'),
    techStack: [],
    scores: [],
  }
}

describe('listJobs pagination', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a bounded page and a nextCursor when more rows exist', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => row(`j${i}`))
    prisma.discoveredJob.findMany.mockResolvedValue(rows)
    prisma.discoveredJob.count.mockResolvedValue(200)

    const result = await listJobs('user-1', { limit: 50 })

    expect(prisma.discoveredJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
      }),
    )
    expect(result.jobs).toHaveLength(50)
    expect(result.nextCursor).toBe('j49')
    expect(result.total).toBe(200)
  })

  it('seeks past the cursor on the next page', async () => {
    prisma.discoveredJob.findMany.mockResolvedValue([row('j50')])
    prisma.discoveredJob.count.mockResolvedValue(200)

    const result = await listJobs('user-1', { limit: 50, cursor: 'j49' })

    expect(prisma.discoveredJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 1,
        cursor: { id: 'j49' },
      }),
    )
    expect(result.nextCursor).toBeNull()
  })
})
