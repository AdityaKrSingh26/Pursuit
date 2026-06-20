import { prisma } from '../../lib/db.js'
import { Prisma } from '@prisma/client'
import { AppError } from '../../lib/errors.js'
import { ingestionQueue } from '../../jobs/ingestion/ingestion.queue.js'
import { computeJdHash } from '../../lib/jdHash.js'
import { assertSafeUrl } from '../../lib/ssrfGuard.js'
import { invalidate, CacheKey } from '../../lib/cache.js'
import crypto from 'crypto'

export async function createApplication(userId, data) {
  // Destructure to separate model columns from ingestion-only/temporary input fields
  const { url, rawJd, salaryText: _salaryText, location: _location, deadline: _deadline, ...dbData } = data

  let jd
  if (url) {
    await assertSafeUrl(url)
    // JDs are global — look up by sourceUrl across all users
    jd = await prisma.jobDescription.findFirst({
      where: { sourceUrl: url }
    })
    if (!jd) {
      jd = await prisma.jobDescription.create({
        data: {
          sourceUrl: url,
          rawText: rawJd || '',
          jdHash: 'pending-' + crypto.randomUUID(),
          parseStatus: 'QUEUED'
        }
      })
      await ingestionQueue.add('parse', { jdId: jd.id })
    }
  } else if (rawJd) {
    const jdHash = computeJdHash(rawJd)
    // Global dedup: same content hash → same JD row, zero re-processing
    jd = await prisma.jobDescription.findUnique({
      where: { jdHash }
    })
    if (!jd) {
      jd = await prisma.jobDescription.create({
        data: {
          rawText: rawJd,
          jdHash,
          parseStatus: 'QUEUED'
        }
      })
      await ingestionQueue.add('parse', { jdId: jd.id })
    }
  }

  const appData = {
    ...dbData,
    userId,
    stageEvents: {
      create: {
        fromStage: null,
        toStage: 'SAVED',
      },
    },
  }

  if (jd) {
    appData.jdId = jd.id
  }

  const application = await prisma.application.create({
    data: appData,
    include: {
      stageEvents: { orderBy: { at: 'asc' } },
      jd: true,
    },
  })

  // Invalidate dashboard cache — new application changes funnel counts
  await invalidate(CacheKey.funnelStats(userId), CacheKey.velocityStats(userId))

  return application
}

export async function updateApplication(userId, id, data) {
  const app = await prisma.application.findUnique({
    where: { id },
  })

  if (!app) {
    throw AppError.notFound('Application not found')
  }
  if (app.userId !== userId) {
    throw AppError.forbidden('Forbidden')
  }

  const updateData = {}
  if (data.notes !== undefined) {
    updateData.notes = data.notes
  }
  if (data.nextActionAt !== undefined) {
    updateData.nextActionAt = data.nextActionAt ? new Date(data.nextActionAt) : null
  }
  if (data.company !== undefined) {
    updateData.company = data.company
  }
  if (data.roleTitle !== undefined) {
    updateData.roleTitle = data.roleTitle
  }
  if (data.source !== undefined) {
    updateData.source = data.source
  }

  if (data.stage !== undefined && data.stage !== app.stage) {
    updateData.stage = data.stage
    updateData.stageEvents = {
      create: {
        fromStage: app.stage,
        toStage: data.stage,
      },
    }
    // Enforce that nextActionAt is cleared/null when stage changes to REJECTED/OFFER/GHOSTED if not explicitly set
    if (['REJECTED', 'OFFER', 'GHOSTED'].includes(data.stage) && data.nextActionAt === undefined) {
      updateData.nextActionAt = null
    }
  }

  const updated = await prisma.application.update({
    where: { id },
    data: updateData,
    include: {
      stageEvents: { orderBy: { at: 'asc' } },
      jd: true,
    },
  })

  // Stage change → funnel counts change
  if (updateData.stage) {
    await invalidate(CacheKey.funnelStats(userId))
  }

  return updated
}

export async function listApplications(userId, filters) {
  const limit = filters.limit

  if (filters.q) {
    // Search via pre-built GIN index on search_vector (generated column, O(log n))
    let query = Prisma.sql`
      SELECT * FROM "Application"
      WHERE "userId" = ${userId}
      AND "deletedAt" IS NULL
      AND search_vector @@ plainto_tsquery('english', ${filters.q})
    `

    if (filters.stage) {
      query = Prisma.sql`${query} AND "stage" = ${filters.stage}::"Stage"`
    }
    if (filters.from) {
      query = Prisma.sql`${query} AND "createdAt" >= ${new Date(filters.from)}`
    }
    if (filters.to) {
      query = Prisma.sql`${query} AND "createdAt" <= ${new Date(filters.to)}`
    }
    if (filters.cursor) {
      query = Prisma.sql`${query} AND "createdAt" < ${new Date(filters.cursor)}`
    }

    query = Prisma.sql`${query} ORDER BY "createdAt" DESC LIMIT ${limit}`

    const items = await prisma.$queryRaw(query)

    // Raw queries return objects directly. Map relations to match prisma findMany output structure.
    if (items.length > 0) {
      const itemIds = items.map((item) => item.id)
      const stageEvents = await prisma.stageEvent.findMany({
        where: { applicationId: { in: itemIds } },
        orderBy: { at: 'asc' },
      })
      const jdIds = items.map((item) => item.jdId).filter(Boolean)
      const jds = jdIds.length > 0 ? await prisma.jobDescription.findMany({
        where: { id: { in: jdIds } },
      }) : []

      for (const item of items) {
        item.stageEvents = stageEvents.filter((se) => se.applicationId === item.id)
        item.jd = jds.find((jd) => jd.id === item.jdId) ?? null
      }
    }

    const nextCursor = items.length === limit ? items[items.length - 1].createdAt.toISOString() : null
    return { items, nextCursor }
  }

  // Non-search case
  const where = { userId, deletedAt: null }
  if (filters.stage) {
    where.stage = filters.stage
  }
  if (filters.from || filters.to) {
    where.createdAt = {}
    if (filters.from) {
      where.createdAt.gte = new Date(filters.from)
    }
    if (filters.to) {
      where.createdAt.lte = new Date(filters.to)
    }
  }
  if (filters.cursor) {
    where.createdAt = {
      ...where.createdAt,
      lt: new Date(filters.cursor),
    }
  }

  const items = await prisma.application.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      stageEvents: {
        orderBy: { at: 'asc' },
      },
      jd: true,
    },
  })

  const nextCursor = items.length === limit ? items[items.length - 1].createdAt.toISOString() : null
  return { items, nextCursor }
}

export async function getApplication(userId, id) {
  const app = await prisma.application.findUnique({
    where: { id, deletedAt: null },
    include: {
      stageEvents: {
        orderBy: { at: 'asc' },
      },
      jd: true,
    },
  })

  if (!app) {
    throw AppError.notFound('Application not found')
  }
  if (app.userId !== userId) {
    throw AppError.forbidden('Forbidden')
  }

  return app
}

export async function getStageHistory(userId, id) {
  const app = await getApplication(userId, id)
  return app.stageEvents
}

export async function deleteApplication(userId, id) {
  await getApplication(userId, id)
  await prisma.application.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}
