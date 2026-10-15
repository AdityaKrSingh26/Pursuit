import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'
import { ingestionQueue } from '../../jobs/ingestion/ingestion.queue.js'

export async function findAccessibleJd(userId, jdId) {
  const jd = await prisma.jobDescription.findUnique({ where: { id: jdId } })
  if (!jd) {
    throw AppError.notFound('Job Description not found')
  }

  const owned = await prisma.application.findFirst({
    where: { jdId, userId, deletedAt: null },
    select: { id: true },
  })
  if (!owned) {
    throw AppError.forbidden('Forbidden')
  }

  return jd
}

export async function getJdStatusForUser(userId, jdId) {
  const jd = await findAccessibleJd(userId, jdId)
  return {
    id: jd.id,
    parseStatus: jd.parseStatus,
    parseError: jd.parseError,
    structured: jd.structured,
  }
}

export async function reparseJdForUser(userId, jdId) {
  const jd = await findAccessibleJd(userId, jdId)
  await prisma.jobDescription.update({
    where: { id: jd.id },
    data: { parseStatus: 'QUEUED', parseError: null },
  })
  await ingestionQueue.add('parse', { jdId: jd.id })
  return jd
}
