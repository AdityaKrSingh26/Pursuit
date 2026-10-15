import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'

export async function loadAppWithJd(appId, userId) {
  const app = await prisma.application.findUnique({
    where: { id: appId },
    include: { jd: true },
  })
  if (!app) {
    throw AppError.notFound('Application not found')
  }
  if (app.userId !== userId) {
    throw AppError.forbidden('Forbidden')
  }
  if (!app.jd || app.jd.parseStatus !== 'DONE') {
    throw AppError.badRequest('Job description not parsed yet')
  }
  return app
}
