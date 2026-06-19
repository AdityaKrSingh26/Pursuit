import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import * as dashboardService from './dashboard.service.js'

export const dashboardRouter = Router()
dashboardRouter.use(requireAuth)

// GET /dashboard/funnel
dashboardRouter.get('/dashboard/funnel', async (req, res, next) => {
  try {
    const [funnel, medianDaysInStage] = await Promise.all([
      dashboardService.getFunnel(req.user.id),
      dashboardService.getMedianDaysInStage(req.user.id),
    ])
    res.json({
      ...funnel,
      medianDaysInStage,
    })
  } catch (err) {
    next(err)
  }
})

// GET /dashboard/velocity
dashboardRouter.get('/dashboard/velocity', async (req, res, next) => {
  try {
    const [velocity, llmCost] = await Promise.all([
      dashboardService.getVelocity(req.user.id),
      dashboardService.getLlmCost(req.user.id),
    ])
    res.json({
      velocity,
      llmCost,
    })
  } catch (err) {
    next(err)
  }
})
