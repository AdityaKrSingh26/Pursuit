import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { prisma } from '../../lib/db.js'
import * as intelService from './intel.service.js'

export const intelRouter = Router()
intelRouter.use(requireAuth)

// GET /intel/skill-demand
intelRouter.get('/intel/skill-demand', async (req, res, next) => {
  try {
    const data = await intelService.getSkillDemand(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /intel/gap-frequency
intelRouter.get('/intel/gap-frequency', async (req, res, next) => {
  try {
    const data = await intelService.getGapFrequency(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /intel/clusters
intelRouter.get('/intel/clusters', async (req, res, next) => {
  try {
    const data = await intelService.getClusters(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /applications/:id/similar
intelRouter.get('/applications/:id/similar', async (req, res, next) => {
  try {
    const app = await prisma.application.findUnique({
      where: { id: req.params.id },
      select: { jdId: true },
    })
    if (!app || !app.jdId) {
      return res.json([])
    }
    const data = await intelService.getSimilarJobs(req.user.id, app.jdId)
    res.json(data)
  } catch (err) {
    next(err)
  }
})
