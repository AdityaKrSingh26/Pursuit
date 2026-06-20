import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { ok } from '../../lib/response.js'
import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'
import { ingestionQueue } from '../../jobs/ingestion/ingestion.queue.js'

export const ingestionRouter = Router()
ingestionRouter.use(requireAuth)

ingestionRouter.get('/jd/:id/status', asyncHandler(async (req, res) => {
  const jd = await prisma.jobDescription.findUnique({ where: { id: req.params.id } })
  if (!jd) {
    throw AppError.notFound('Job Description not found')
  }
  if (jd.userId !== req.user.id) {
    throw AppError.forbidden('Forbidden')
  }
  ok(res, {
    id: jd.id,
    parseStatus: jd.parseStatus,
    parseError: jd.parseError,
    structured: jd.structured,
  })
}))

ingestionRouter.post('/jd/:id/reparse', requireCsrf, asyncHandler(async (req, res) => {
  const jd = await prisma.jobDescription.findUnique({ where: { id: req.params.id } })
  if (!jd) {
    throw AppError.notFound('Job Description not found')
  }
  if (jd.userId !== req.user.id) {
    throw AppError.forbidden('Forbidden')
  }

  await prisma.jobDescription.update({
    where: { id: jd.id },
    data: { parseStatus: 'QUEUED', parseError: null },
  })

  await ingestionQueue.add('parse', { jdId: jd.id })

  res.status(202).end()
}))
