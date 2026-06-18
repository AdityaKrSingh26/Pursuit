import { prisma } from '../../lib/db.js'
import { Prisma } from '@prisma/client'
import { AppError } from '../../lib/errors.js'

export async function createApplication(userId, data) {
  // Destructure to separate model columns from ingestion-only/temporary input fields
  const { url, rawJd, salaryText, location, deadline, ...dbData } = data

  const application = await prisma.application.create({
    data: {
      ...dbData,
      userId,
      stageEvents: {
        create: {
          fromStage: null,
          toStage: 'SAVED',
        },
      },
    },
    include: {
      stageEvents: {
        orderBy: { at: 'asc' },
      },
      jd: true,
    },
  })

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
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.nextActionAt !== undefined) {
    updateData.nextActionAt = data.nextActionAt ? new Date(data.nextActionAt) : null
  }
  if (data.company !== undefined) updateData.company = data.company
  if (data.roleTitle !== undefined) updateData.roleTitle = data.roleTitle
  if (data.source !== undefined) updateData.source = data.source

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
      stageEvents: {
        orderBy: { at: 'asc' },
      },
      jd: true,
    },
  })

  return updated
}

export async function listApplications(userId, filters) {
  const limit = filters.limit

  if (filters.q) {
    // Search case - PostgreSQL Full-Text Search (FTS)
    let query = Prisma.sql`
      SELECT * FROM "Application"
      WHERE "userId" = ${userId}
      AND to_tsvector('english', "company" || ' ' || "roleTitle" || ' ' || COALESCE("notes", '')) @@ plainto_tsquery('english', ${filters.q})
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
        item.jd = jds.find((jd) => jd.id === item.jdId) || null
      }
    }

    const nextCursor = items.length === limit ? items[items.length - 1].createdAt.toISOString() : null
    return { items, nextCursor }
  }

  // Non-search case
  const where = { userId }
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
    where: { id },
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
  await prisma.application.delete({
    where: { id },
  })
}
