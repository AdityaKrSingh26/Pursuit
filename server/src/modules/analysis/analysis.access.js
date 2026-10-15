import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'

export async function loadOwnedApplication(appId, userId, include) {
  const app = await prisma.application.findFirst({
    where: { id: appId },
    include,
  })
  if (!app || app.deletedAt) {
    throw AppError.notFound('Application not found')
  }
  if (app.userId !== userId) {
    throw AppError.forbidden('Forbidden')
  }
  return app
}

export async function loadAppWithJd(appId, userId) {
  const app = await loadOwnedApplication(appId, userId, { jd: true })
  if (!app.jd || app.jd.parseStatus !== 'DONE') {
    throw AppError.badRequest('Job description not parsed yet')
  }
  return app
}
