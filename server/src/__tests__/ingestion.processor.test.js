import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeJdHash } from '../lib/jdHash.js'

vi.mock('../lib/db.js', () => ({
  prisma: {
    jobDescription: {
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    application: {
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../jobs/ingestion/fetcher.js', () => ({
  fetchAndExtract: vi.fn(),
}))

vi.mock('../jobs/ingestion/jdParser.js', () => ({
  parseJd: vi.fn(),
}))

vi.mock('../jobs/embedding/embedding.queue.js', () => ({
  embeddingQueue: { add: vi.fn() },
}))

import { prisma } from '../lib/db.js'
import { parseJd } from '../jobs/ingestion/jdParser.js'
import { embeddingQueue } from '../jobs/embedding/embedding.queue.js'
import { ingestionProcessor } from '../jobs/ingestion/processor.js'

const RAW = 'We want a backend engineer who knows TypeScript.'
const HASH = computeJdHash(RAW)
const STRUCTURED = { title: 'Backend Engineer', skills: ['TypeScript'] }

function seedJds(rows) {
  const store = new Map(rows.map((r) => [r.id, { ...r }]))

  prisma.jobDescription.findUniqueOrThrow.mockImplementation(async ({ where }) => {
    const row = store.get(where.id)
    if (!row) throw new Error(`JobDescription ${where.id} not found`)
    return { ...row }
  })

  prisma.jobDescription.findFirst.mockImplementation(async ({ where }) => {
    if (Object.prototype.hasOwnProperty.call(where, 'userId')) {
      throw new Error('Unknown argument `userId` for JobDescriptionFindFirstArgs.where')
    }
    for (const row of store.values()) {
      if (where.jdHash !== undefined && row.jdHash !== where.jdHash) continue
      if (where.id?.not !== undefined && row.id === where.id.not) continue
      return { ...row }
    }
    return null
  })

  prisma.jobDescription.update.mockImplementation(async ({ where, data }) => {
    const row = store.get(where.id)
    Object.assign(row, data)
    return { ...row }
  })

  prisma.jobDescription.delete.mockImplementation(async ({ where }) => {
    const row = store.get(where.id)
    store.delete(where.id)
    return row
  })

  return store
}

describe('ingestionProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    parseJd.mockResolvedValue(STRUCTURED)
    embeddingQueue.add.mockResolvedValue({ id: 'job-1' })
    prisma.application.updateMany.mockResolvedValue({ count: 0 })
  })

  it('parses a new JD without querying userId and marks it DONE', async () => {
    const pendingId = 'jd-pending'
    seedJds([
      {
        id: pendingId,
        sourceUrl: null,
        rawText: RAW,
        jdHash: 'pending-abc',
        structured: null,
        parseStatus: 'QUEUED',
        parseError: null,
      },
    ])

    await ingestionProcessor({ data: { jdId: pendingId } })

    expect(parseJd).toHaveBeenCalledWith(RAW)
    const done = await prisma.jobDescription.findUniqueOrThrow({ where: { id: pendingId } })
    expect(done.parseStatus).toBe('DONE')
    expect(done.jdHash).toBe(HASH)
    expect(done.structured).toEqual(STRUCTURED)
    expect(embeddingQueue.add).toHaveBeenCalledWith('embed', { jdId: pendingId })
  })

  it('retargets applications onto the existing hash row instead of writing a duplicate jdHash', async () => {
    const existingId = 'jd-existing'
    const pendingId = 'jd-pending'
    seedJds([
      {
        id: existingId,
        sourceUrl: 'https://example.com/jobs/1',
        rawText: RAW,
        jdHash: HASH,
        structured: STRUCTURED,
        parseStatus: 'DONE',
        parseError: null,
      },
      {
        id: pendingId,
        sourceUrl: 'https://other.example/jobs/1',
        rawText: RAW,
        jdHash: 'pending-xyz',
        structured: null,
        parseStatus: 'QUEUED',
        parseError: null,
      },
    ])
    prisma.application.updateMany.mockResolvedValue({ count: 1 })

    await ingestionProcessor({ data: { jdId: pendingId } })

    expect(parseJd).not.toHaveBeenCalled()
    expect(prisma.application.updateMany).toHaveBeenCalledWith({
      where: { jdId: pendingId },
      data: { jdId: existingId },
    })
    expect(prisma.jobDescription.delete).toHaveBeenCalledWith({ where: { id: pendingId } })
    expect(embeddingQueue.add).toHaveBeenCalledWith('embed', { jdId: existingId })
  })
})
