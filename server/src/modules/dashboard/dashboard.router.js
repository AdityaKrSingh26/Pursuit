import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { ok } from '../../lib/response.js'
import * as dashboardService from './dashboard.service.js'

export const dashboardRouter = Router()
dashboardRouter.use(requireAuth)

dashboardRouter.get('/dashboard/funnel', asyncHandler(async (req, res) => {
  const [funnel, medianDaysInStage] = await Promise.all([
    dashboardService.getFunnel(req.user.id),
    dashboardService.getMedianDaysInStage(req.user.id),
  ])
  ok(res, { ...funnel, medianDaysInStage })
}))

dashboardRouter.get('/dashboard/velocity', asyncHandler(async (req, res) => {
  const [velocity, llmCost] = await Promise.all([
    dashboardService.getVelocity(req.user.id),
    dashboardService.getLlmCost(req.user.id),
  ])
  ok(res, { velocity, llmCost })
}))
