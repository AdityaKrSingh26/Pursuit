import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db.js', () => ({
  prisma: {
    jobDescription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    application: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('../jobs/ingestion/ingestion.queue.js', () => ({
  ingestionQueue: { add: vi.fn() },
}))

import { prisma } from '../lib/db.js'
import { ingestionQueue } from '../jobs/ingestion/ingestion.queue.js'
import { findAccessibleJd, getJdStatusForUser, reparseJdForUser } from '../modules/ingestion/ingestion.service.js'

const OWNER = 'user-owner'
const OTHER = 'user-other'
const JD_ID = 'jd-1'
const JD = {
  id: JD_ID,
  sourceUrl: 'https://example.com/jobs/1',
  rawText: 'A job',
  jdHash: 'abc',
  structured: { title: 'Engineer', skills: [] },
  parseStatus: 'DONE',
  parseError: null,
}

describe('findAccessibleJd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.jobDescription.findUnique.mockResolvedValue(JD)
  })

  it('returns the JD when the user has a live application pointing at it', async () => {
    prisma.application.findFirst.mockResolvedValue({ id: 'app-1' })
    const jd = await findAccessibleJd(OWNER, JD_ID)
    expect(jd.id).toBe(JD_ID)
    expect(prisma.application.findFirst).toHaveBeenCalledWith({
      where: { jdId: JD_ID, userId: OWNER, deletedAt: null },
      select: { id: true },
    })
  })

  it('returns 404 when the JD does not exist', async () => {
    prisma.jobDescription.findUnique.mockResolvedValue(null)
    await expect(findAccessibleJd(OWNER, JD_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  })

  it('returns 403 when the user has no application for that JD', async () => {
    prisma.application.findFirst.mockResolvedValue(null)
    await expect(findAccessibleJd(OTHER, JD_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    })
  })

  it('returns 403 when the only linking application is soft-deleted', async () => {
    prisma.application.findFirst.mockResolvedValue(null)
    await expect(findAccessibleJd(OWNER, JD_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    })
    expect(prisma.application.findFirst).toHaveBeenCalledWith({
      where: { jdId: JD_ID, userId: OWNER, deletedAt: null },
      select: { id: true },
    })
  })
})

describe('getJdStatusForUser / reparseJdForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.jobDescription.findUnique.mockResolvedValue(JD)
    prisma.application.findFirst.mockResolvedValue({ id: 'app-1' })
    prisma.jobDescription.update.mockResolvedValue({ ...JD, parseStatus: 'QUEUED' })
    ingestionQueue.add.mockResolvedValue({ id: 'q1' })
  })

  it('returns parse fields for an owner', async () => {
    const status = await getJdStatusForUser(OWNER, JD_ID)
    expect(status).toEqual({
      id: JD_ID,
      parseStatus: 'DONE',
      parseError: null,
      structured: JD.structured,
    })
  })

  it('requeues parse for an owner', async () => {
    await reparseJdForUser(OWNER, JD_ID)
    expect(prisma.jobDescription.update).toHaveBeenCalledWith({
      where: { id: JD_ID },
      data: { parseStatus: 'QUEUED', parseError: null },
    })
    expect(ingestionQueue.add).toHaveBeenCalledWith('parse', { jdId: JD_ID })
  })

  it('does not requeue for a stranger', async () => {
    prisma.application.findFirst.mockResolvedValue(null)
    await expect(reparseJdForUser(OTHER, JD_ID)).rejects.toMatchObject({ statusCode: 403 })
    expect(ingestionQueue.add).not.toHaveBeenCalled()
  })
})
