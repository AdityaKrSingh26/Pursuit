import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'

export const remindersRouter = Router()
remindersRouter.use(requireAuth)

// GET /reminders/pending
remindersRouter.get('/reminders/pending', async (req, res, next) => {
  try {
    const list = await prisma.reminder.findMany({
      where: {
        dismissedAt: null,
        application: {
          userId: req.user.id,
        },
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
      orderBy: {
        createdAt: 'desc',
      },
    })
    
    res.json(list.map((r) => {
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
  } catch (err) {
    next(err)
  }
})

// POST /reminders/:id/dismiss
remindersRouter.post('/reminders/:id/dismiss', requireCsrf, async (req, res, next) => {
  try {
    const reminder = await prisma.reminder.findUnique({
      where: { id: req.params.id },
      include: {
        application: true,
      },
    })
    if (!reminder) {
      throw AppError.notFound('Reminder not found')
    }
    if (reminder.application.userId !== req.user.id) {
      throw AppError.forbidden('Forbidden')
    }

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { dismissedAt: new Date() },
    })

    res.status(200).json({ ok: true })
  } catch (err) {
    next(err)
  }
})
