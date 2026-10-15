import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { ok } from '../../lib/response.js'
import { dismissReminder, listPendingReminders } from './reminders.service.js'

export const remindersRouter = Router()
remindersRouter.use(requireAuth)

remindersRouter.get('/reminders/pending', asyncHandler(async (req, res) => {
  ok(res, await listPendingReminders(req.user.id))
}))

remindersRouter.post('/reminders/:id/dismiss', requireCsrf, asyncHandler(async (req, res) => {
  await dismissReminder(req.user.id, req.params.id)
  ok(res, { ok: true })
}))
