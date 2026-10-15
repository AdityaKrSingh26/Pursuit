import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../lib/errors.js'

vi.mock('../lib/db.js', () => ({
  prisma: {
    application: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../jobs/ingestion/ingestion.queue.js', () => ({
  ingestionQueue: { add: vi.fn() },
}))

vi.mock('../lib/cache.js', () => ({
  invalidate: vi.fn(),
  CacheKey: {
    funnelStats: (userId) => `dashboard:funnel:${userId}`,
    velocityStats: (userId) => `dashboard:velocity:${userId}`,
  },
}))

import { prisma } from '../lib/db.js'
import { getApplication, deleteApplication } from '../modules/applications/applications.service.js'

const OWNER = 'user-owner'
const OTHER = 'user-other'
const APP_ID = 'app-1'

function seedApps(rows) {
  prisma.application.findUnique.mockImplementation(async ({ where }) => {
    for (const key of Object.keys(where)) {
      if (key !== 'id') {
        throw new Error(
          `Unknown argument \`${key}\` in where.${key} for type ApplicationWhereUniqueInput.`,
        )
      }
    }
    return rows.find((r) => r.id === where.id) ?? null
  })

  prisma.application.findFirst.mockImplementation(async ({ where, include }) => {
    const row = rows.find((r) => {
      if (where.id !== undefined && r.id !== where.id) return false
      if (where.userId !== undefined && r.userId !== where.userId) return false
      if (Object.prototype.hasOwnProperty.call(where, 'deletedAt') && r.deletedAt !== where.deletedAt) {
        return false
      }
      return true
    })
    if (!row) return null
    return {
      ...row,
      stageEvents: include?.stageEvents ? (row.stageEvents ?? []) : undefined,
      jd: include?.jd ? (row.jd ?? null) : undefined,
    }
  })
}

describe('getApplication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the owner application that is not soft-deleted', async () => {
    seedApps([
      {
        id: APP_ID,
        userId: OWNER,
        deletedAt: null,
        company: 'Acme',
        roleTitle: 'Engineer',
        stageEvents: [],
        jd: null,
      },
    ])

    const app = await getApplication(OWNER, APP_ID)
    expect(app.id).toBe(APP_ID)
    expect(app.userId).toBe(OWNER)
  })

  it('returns 404 for a missing application', async () => {
    seedApps([])
    await expect(getApplication(OWNER, APP_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  })

  it('returns 404 for another user\'s application', async () => {
    seedApps([
      {
        id: APP_ID,
        userId: OWNER,
        deletedAt: null,
        company: 'Acme',
        roleTitle: 'Engineer',
        stageEvents: [],
        jd: null,
      },
    ])
    await expect(getApplication(OTHER, APP_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  })

  it('returns 404 for a soft-deleted application', async () => {
    seedApps([
      {
        id: APP_ID,
        userId: OWNER,
        deletedAt: new Date('2026-01-01T00:00:00.000Z'),
        company: 'Acme',
        roleTitle: 'Engineer',
        stageEvents: [],
        jd: null,
      },
    ])
    await expect(getApplication(OWNER, APP_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  })
})

describe('deleteApplication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.application.update.mockResolvedValue({})
  })

  it('soft-deletes the owner application', async () => {
    seedApps([
      {
        id: APP_ID,
        userId: OWNER,
        deletedAt: null,
        company: 'Acme',
        roleTitle: 'Engineer',
        stageEvents: [],
        jd: null,
      },
    ])

    await deleteApplication(OWNER, APP_ID)
    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: APP_ID },
      data: { deletedAt: expect.any(Date) },
    })
  })

  it('does not update when the application is already deleted', async () => {
    seedApps([
      {
        id: APP_ID,
        userId: OWNER,
        deletedAt: new Date('2026-01-01T00:00:00.000Z'),
        company: 'Acme',
        roleTitle: 'Engineer',
        stageEvents: [],
        jd: null,
      },
    ])

    await expect(deleteApplication(OWNER, APP_ID)).rejects.toBeInstanceOf(AppError)
    expect(prisma.application.update).not.toHaveBeenCalled()
  })
})
