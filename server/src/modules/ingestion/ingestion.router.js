import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'
import { ingestionQueue } from '../../jobs/ingestion/ingestion.queue.js'

export const ingestionRouter = Router()

ingestionRouter.use(requireAuth)

// GET /jd/:id/status
ingestionRouter.get('/jd/:id/status', async (req, res, next) => {
  try {
    const jd = await prisma.jobDescription.findUnique({
      where: { id: req.params.id }
    })
    if (!jd) {
      throw AppError.notFound('Job Description not found')
    }
    if (jd.userId !== req.user.id) {
      throw AppError.forbidden('Forbidden')
    }
    res.json({
      id: jd.id,
      parseStatus: jd.parseStatus,
      parseError: jd.parseError,
      structured: jd.structured
    })
  } catch (err) {
    next(err)
  }
})

// POST /jd/:id/reparse
ingestionRouter.post('/jd/:id/reparse', requireCsrf, async (req, res, next) => {
  try {
    const jd = await prisma.jobDescription.findUnique({
      where: { id: req.params.id }
    })
    if (!jd) {
      throw AppError.notFound('Job Description not found')
    }
    if (jd.userId !== req.user.id) {
      throw AppError.forbidden('Forbidden')
    }

    await prisma.jobDescription.update({
      where: { id: jd.id },
      data: {
        parseStatus: 'QUEUED',
        parseError: null
      }
    })

    await ingestionQueue.add('parse', { jdId: jd.id })

    res.status(202).end()
  } catch (err) {
    next(err)
  }
})
