import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db.js', () => ({
  prisma: {
    resumeBlock: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    resumeUpload: { findUnique: vi.fn() },
    resumeVersion: { findUnique: vi.fn() },
    reminder: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    application: { findUnique: vi.fn() },
  },
}))

import { prisma } from '../lib/db.js'
import { updateBlock, archiveBlock } from '../modules/resume/resumeBlocks.service.js'
import { getResumeUploadForUser, getResumeVersionForUser } from '../modules/resume/resumeAccess.js'
import { dismissReminder } from '../modules/reminders/reminders.service.js'
import { loadAppWithJd } from '../modules/analysis/analysis.access.js'

const OWNER = 'user-owner'
const OTHER = 'user-other'

describe('IDOR: resume blocks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('forbids updating another user\'s block', async () => {
    prisma.resumeBlock.findUnique.mockResolvedValue({ id: 'b1', userId: OWNER })
    await expect(updateBlock(OTHER, 'b1', { content: 'x' })).rejects.toMatchObject({ statusCode: 403 })
    expect(prisma.resumeBlock.update).not.toHaveBeenCalled()
  })

  it('forbids archiving another user\'s block', async () => {
    prisma.resumeBlock.findUnique.mockResolvedValue({ id: 'b1', userId: OWNER })
    await expect(archiveBlock(OTHER, 'b1')).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('IDOR: resume upload and version', () => {
  beforeEach(() => vi.clearAllMocks())

  it('forbids reading another user\'s upload', async () => {
    prisma.resumeUpload.findUnique.mockResolvedValue({ id: 'u1', userId: OWNER })
    await expect(getResumeUploadForUser(OTHER, 'u1')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('forbids reading another user\'s resume version', async () => {
    prisma.resumeVersion.findUnique.mockResolvedValue({ id: 'v1', userId: OWNER })
    await expect(getResumeVersionForUser(OTHER, 'v1')).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('IDOR: reminders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('forbids dismissing another user\'s reminder', async () => {
    prisma.reminder.findUnique.mockResolvedValue({
      id: 'r1',
      application: { userId: OWNER },
    })
    await expect(dismissReminder(OTHER, 'r1')).rejects.toMatchObject({ statusCode: 403 })
    expect(prisma.reminder.update).not.toHaveBeenCalled()
  })
})

describe('IDOR: analysis application', () => {
  beforeEach(() => vi.clearAllMocks())

  it('forbids loading another user\'s application for analysis', async () => {
    prisma.application.findUnique.mockResolvedValue({
      id: 'a1',
      userId: OWNER,
      jd: { parseStatus: 'DONE' },
    })
    await expect(loadAppWithJd('a1', OTHER)).rejects.toMatchObject({ statusCode: 403 })
  })
})
