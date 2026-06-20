import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { ok } from '../../lib/response.js'
import { prisma } from '../../lib/db.js'
import * as intelService from './intel.service.js'

export const intelRouter = Router()
intelRouter.use(requireAuth)

intelRouter.get('/intel/skill-demand', asyncHandler(async (req, res) => {
  ok(res, await intelService.getSkillDemand(req.user.id))
}))

intelRouter.get('/intel/gap-frequency', asyncHandler(async (req, res) => {
  ok(res, await intelService.getGapFrequency(req.user.id))
}))

intelRouter.get('/intel/clusters', asyncHandler(async (req, res) => {
  ok(res, await intelService.getClusters(req.user.id))
}))

intelRouter.get('/applications/:id/similar', asyncHandler(async (req, res) => {
  const app = await prisma.application.findUnique({
    where: { id: req.params.id },
    select: { jdId: true },
  })
  if (!app || !app.jdId) {
    return ok(res, [])
  }
  ok(res, await intelService.getSimilarJobs(req.user.id, app.jdId))
}))
