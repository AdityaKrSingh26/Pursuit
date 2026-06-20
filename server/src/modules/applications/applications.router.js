import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { validateBody, validateQuery } from '../../lib/validate.js'
import { ok, created, noContent } from '../../lib/response.js'
import {
  CreateApplicationSchema,
  UpdateApplicationSchema,
  ListApplicationsSchema,
} from './applications.schemas.js'
import * as service from './applications.service.js'

export const applicationsRouter = Router()
applicationsRouter.use(requireAuth)

applicationsRouter.get('/applications', validateQuery(ListApplicationsSchema), asyncHandler(async (req, res) => {
  const result = await service.listApplications(req.user.id, req.query)
  ok(res, result)
}))

applicationsRouter.post('/applications', requireCsrf, validateBody(CreateApplicationSchema), asyncHandler(async (req, res) => {
  const app = await service.createApplication(req.user.id, req.body)
  created(res, app)
}))

applicationsRouter.get('/applications/:id', asyncHandler(async (req, res) => {
  const app = await service.getApplication(req.user.id, req.params.id)
  ok(res, app)
}))

applicationsRouter.patch('/applications/:id', requireCsrf, validateBody(UpdateApplicationSchema), asyncHandler(async (req, res) => {
  const app = await service.updateApplication(req.user.id, req.params.id, req.body)
  ok(res, app)
}))

applicationsRouter.delete('/applications/:id', requireCsrf, asyncHandler(async (req, res) => {
  await service.deleteApplication(req.user.id, req.params.id)
  noContent(res)
}))

applicationsRouter.get('/applications/:id/stage-history', asyncHandler(async (req, res) => {
  const history = await service.getStageHistory(req.user.id, req.params.id)
  ok(res, history)
}))
