import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'

export async function listPendingReminders(userId) {
  const list = await prisma.reminder.findMany({
    where: {
      dismissedAt: null,
      application: { userId, deletedAt: null },
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

  return list.map((r) => {
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
  })
}

export async function dismissReminder(userId, id) {
  const reminder = await prisma.reminder.findUnique({
    where: { id },
    include: { application: true },
  })
  if (!reminder) {
    throw AppError.notFound('Reminder not found')
  }
  if (reminder.application.userId !== userId) {
    throw AppError.forbidden('Forbidden')
  }

  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { dismissedAt: new Date() },
  })

  return reminder
}
