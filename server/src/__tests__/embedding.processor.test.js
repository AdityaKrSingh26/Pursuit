import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db.js', () => ({
  prisma: {
    jobDescription: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
  },
}))

vi.mock('../lib/llm.js', () => ({
  embed: vi.fn(),
}))

import { prisma } from '../lib/db.js'
import { embed } from '../lib/llm.js'
import { embeddingProcessor } from '../jobs/embedding/embeddingProcessor.js'

describe('embeddingProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.jobDescription.findUnique.mockResolvedValue({ id: 'jd-1', rawText: 'hello' })
    prisma.$executeRaw.mockResolvedValue(1)
  })

  it('stores a 1536-dim vector', async () => {
    embed.mockResolvedValue(Array(1536).fill(0.1))
    await embeddingProcessor({ data: { jdId: 'jd-1' } })
    expect(prisma.$executeRaw).toHaveBeenCalled()
  })

  it('refuses to zero-pad a short embedding', async () => {
    embed.mockResolvedValue(Array(8).fill(0.1))
    await expect(embeddingProcessor({ data: { jdId: 'jd-1' } })).rejects.toThrow(/1536/)
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('refuses to truncate a long embedding', async () => {
    embed.mockResolvedValue(Array(2000).fill(0.1))
    await expect(embeddingProcessor({ data: { jdId: 'jd-1' } })).rejects.toThrow(/1536/)
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })
})
