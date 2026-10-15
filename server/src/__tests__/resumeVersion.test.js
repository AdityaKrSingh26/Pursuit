import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db.js', () => ({
  prisma: {
    application: { findFirst: vi.fn() },
    resumeVersion: { upsert: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('../jobs/pdf/pdf.queue.js', () => ({
  pdfQueue: { add: vi.fn() },
}))

import { prisma } from '../lib/db.js'
import { pdfQueue } from '../jobs/pdf/pdf.queue.js'
import { upsertResumeVersion } from '../modules/resume/resumeVersion.service.js'

const OWNER = 'user-1'
const APP_ID = 'app-1'
const blocks = [
  { blockId: 'b1', section: 'EXPERIENCE', content: 'Shipped it', skillTags: ['Go'] },
]

describe('upsertResumeVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.application.findFirst.mockResolvedValue({ id: APP_ID, userId: OWNER, deletedAt: null })
    prisma.resumeVersion.upsert.mockResolvedValue({ id: 'ver-1' })
  })

  it('upserts on applicationId and resets render state so a second PDF does not unique-fail', async () => {
    await upsertResumeVersion(OWNER, APP_ID, blocks)
    await upsertResumeVersion(OWNER, APP_ID, blocks)

    expect(prisma.resumeVersion.create).not.toHaveBeenCalled()
    expect(prisma.resumeVersion.upsert).toHaveBeenCalledTimes(2)
    expect(prisma.resumeVersion.upsert).toHaveBeenCalledWith({
      where: { applicationId: APP_ID },
      create: expect.objectContaining({
        userId: OWNER,
        applicationId: APP_ID,
        renderStatus: 'PENDING',
      }),
      update: expect.objectContaining({
        pdfKey: null,
        renderStatus: 'PENDING',
        renderError: null,
      }),
    })
    expect(pdfQueue.add).toHaveBeenCalledTimes(2)
  })

  it('stores section and skillTags on the snapshot', async () => {
    await upsertResumeVersion(OWNER, APP_ID, blocks)
    const snapshot = prisma.resumeVersion.upsert.mock.calls[0][0].create.blocksSnapshot
    expect(snapshot[0]).toMatchObject({
      blockId: 'b1',
      section: 'EXPERIENCE',
      content: 'Shipped it',
      skillTags: ['Go'],
    })
  })

  it('404s for another user or a deleted application', async () => {
    prisma.application.findFirst.mockResolvedValue(null)
    await expect(upsertResumeVersion('other', APP_ID, blocks)).rejects.toMatchObject({ statusCode: 404 })
    expect(prisma.resumeVersion.upsert).not.toHaveBeenCalled()
  })
})
