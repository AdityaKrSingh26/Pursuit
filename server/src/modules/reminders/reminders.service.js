import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'

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
