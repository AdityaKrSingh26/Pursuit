import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { AppError } from '../../lib/errors.js'
import {
  CreateApplicationSchema,
  UpdateApplicationSchema,
  ListApplicationsSchema,
} from './applications.schemas.js'
import * as service from './applications.service.js'

export const applicationsRouter = Router()

// All routes require authentication
applicationsRouter.use(requireAuth)

// GET /applications
applicationsRouter.get('/applications', async (req, res, next) => {
  try {
    const parsed = ListApplicationsSchema.safeParse(req.query)
    if (!parsed.success) {
      throw AppError.badRequest(parsed.error.issues[0].message)
    }
    const result = await service.listApplications(req.user.id, parsed.data)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// POST /applications
applicationsRouter.post('/applications', requireCsrf, async (req, res, next) => {
  try {
    const parsed = CreateApplicationSchema.safeParse(req.body)
    if (!parsed.success) {
      throw AppError.badRequest(parsed.error.issues[0].message)
    }
    const app = await service.createApplication(req.user.id, parsed.data)
    res.status(201).json(app)
  } catch (err) {
    next(err)
  }
})

// GET /applications/:id
applicationsRouter.get('/applications/:id', async (req, res, next) => {
  try {
    const app = await service.getApplication(req.user.id, req.params.id)
    res.json(app)
  } catch (err) {
    next(err)
  }
})

// PATCH /applications/:id
applicationsRouter.patch('/applications/:id', requireCsrf, async (req, res, next) => {
  try {
    const parsed = UpdateApplicationSchema.safeParse(req.body)
    if (!parsed.success) {
      throw AppError.badRequest(parsed.error.issues[0].message)
    }
    const app = await service.updateApplication(req.user.id, req.params.id, parsed.data)
    res.json(app)
  } catch (err) {
    next(err)
  }
})

// DELETE /applications/:id
applicationsRouter.delete('/applications/:id', requireCsrf, async (req, res, next) => {
  try {
    await service.deleteApplication(req.user.id, req.params.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// GET /applications/:id/stage-history
applicationsRouter.get('/applications/:id/stage-history', async (req, res, next) => {
  try {
    const history = await service.getStageHistory(req.user.id, req.params.id)
    res.json(history)
  } catch (err) {
    next(err)
  }
})
