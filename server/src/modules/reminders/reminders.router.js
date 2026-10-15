import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { ok } from '../../lib/response.js'
import { prisma } from '../../lib/db.js'
import { dismissReminder } from './reminders.service.js'

export const remindersRouter = Router()
remindersRouter.use(requireAuth)

remindersRouter.get('/reminders/pending', asyncHandler(async (req, res) => {
  const list = await prisma.reminder.findMany({
    where: {
      dismissedAt: null,
      application: { userId: req.user.id },
    },
    include: {
      application: {
        select: {
          company: true,
          roleTitle: true,
          stage: true,
          createdAt: true,
          stageEvents: {
            orderBy: { at: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  ok(res, list.map((r) => {
    const lastEventAt = r.application.stageEvents[0]?.at ?? r.application.createdAt
    const daysSince = Math.round((Date.now() - new Date(lastEventAt).getTime()) / (24 * 60 * 60 * 1000))
    return {
      id: r.id,
      windowKey: r.windowKey,
      draftEmail: r.draftEmail,
      createdAt: r.createdAt,
      daysSince,
      application: {
        company: r.application.company,
        roleTitle: r.application.roleTitle,
        stage: r.application.stage,
      },
    }
  }))
}))

remindersRouter.post('/reminders/:id/dismiss', requireCsrf, asyncHandler(async (req, res) => {
  await dismissReminder(req.user.id, req.params.id)
  ok(res, { ok: true })
}))
