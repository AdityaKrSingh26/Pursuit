import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { ok } from '../../lib/response.js'
import { discoveryQueue } from '../../jobs/discovery/discovery.queue.js'
import { isStale, getLastScanAt, listJobs, scoreJobsForUser } from './jobs.service.js'

export const jobsRouter = Router()
jobsRouter.use(requireAuth)

jobsRouter.get('/jobs', asyncHandler(async (req, res) => {
  const jobs = await listJobs(req.user.id)
  const lastScanAt = await getLastScanAt()
  ok(res, { jobs, lastScanAt, total: jobs.length })
}))

jobsRouter.post('/jobs/refresh', requireCsrf, asyncHandler(async (req, res) => {
  const stale = await isStale()
  if (!stale) {
    const lastScanAt = await getLastScanAt()
    return ok(res, { status: 'fresh', lastScanAt })
  }

  // Check if a scan is already queued or running
  const waiting = await discoveryQueue.getWaiting()
  const active = await discoveryQueue.getActive()
  if (waiting.length > 0 || active.length > 0) {
    return ok(res, { status: 'already_running' })
  }

  await discoveryQueue.add('scan', {}, { removeOnComplete: 10, removeOnFail: 5 })
  ok(res, { status: 'queued' })
}))

jobsRouter.get('/jobs/scan-status', asyncHandler(async (req, res) => {
  const waiting = await discoveryQueue.getWaiting()
  const active = await discoveryQueue.getActive()
  const lastScanAt = await getLastScanAt()

  let status = 'idle'
  let progress = 0

  if (active.length > 0) {
    status = 'running'
    progress = active[0].progress ?? 0
  } else if (waiting.length > 0) {
    status = 'queued'
  }

  ok(res, { status, progress, lastScanAt })
}))

jobsRouter.post('/jobs/score', requireCsrf, asyncHandler(async (req, res) => {
  const result = await scoreJobsForUser(req.user.id)
  ok(res, result)
}))
