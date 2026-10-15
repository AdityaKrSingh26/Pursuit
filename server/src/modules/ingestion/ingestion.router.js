import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { ok } from '../../lib/response.js'
import { getJdStatusForUser, reparseJdForUser } from './ingestion.service.js'

export const ingestionRouter = Router()
ingestionRouter.use(requireAuth)

ingestionRouter.get('/jd/:id/status', asyncHandler(async (req, res) => {
  ok(res, await getJdStatusForUser(req.user.id, req.params.id))
}))

ingestionRouter.post('/jd/:id/reparse', requireCsrf, asyncHandler(async (req, res) => {
  await reparseJdForUser(req.user.id, req.params.id)
  res.status(202).end()
}))
