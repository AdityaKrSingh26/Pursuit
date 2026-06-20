import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { rateLimitLlm } from '../../middleware/rateLimitLlm.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { ok } from '../../lib/response.js'
import { initSse, sendSseEvent } from '../../lib/sse.js'
import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'
import { streamLlm } from '../../llm/llm.service.js'
import { computeMatchScore } from '../../llm/scoring.js'
import { SYSTEM_PROMPT, buildGapPrompt, VERSION } from '../../prompts/gap-analysis.js'
import { GapAnalysisSchema } from '../../llm/schemas/gapAnalysis.schema.js'
import { checkPrepRateLimit } from './prepRateLimit.js'
import { SYSTEM_PROMPT as PREP_SYSTEM_PROMPT, buildPrepPrompt, VERSION as PREP_VERSION } from '../../prompts/prep-generator.js'
import { PrepSchema } from '../../llm/schemas/prep.schema.js'

export const analysisRouter = Router()
analysisRouter.use(requireAuth)

async function loadAppWithJd(appId, userId) {
  const app = await prisma.application.findUnique({
    where: { id: appId },
    include: { jd: true },
  })
  if (!app) {
    throw AppError.notFound('Application not found')
  }
  if (app.userId !== userId) {
    throw AppError.forbidden('Forbidden')
  }
  if (!app.jd || app.jd.parseStatus !== 'DONE') {
    throw AppError.badRequest('Job description not parsed yet')
  }
  return app
}

// POST /applications/:id/analysis/gap
analysisRouter.post('/applications/:id/analysis/gap', requireCsrf, rateLimitLlm, async (req, res, next) => {
  let app
  try {
    app = await loadAppWithJd(req.params.id, req.user.id)
  } catch (err) {
    return next(err)
  }

  const resumeBlocks = await prisma.resumeBlock.findMany({
    where: { userId: req.user.id, archivedAt: null },
  })

  initSse(res)
  const userMessage = buildGapPrompt(app.jd.structured, resumeBlocks)

  try {
    await streamLlm({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      schema: GapAnalysisSchema,
      applicationId: app.id,
      kind: 'GAP',
      jdHash: app.jd.jdHash,
      resumeVersionId: undefined,
      promptVersion: VERSION,
    }, (token) => {
      sendSseEvent(res, { type: 'token', content: token })
    }, (result) => {
      const scoreResult = computeMatchScore(
        result.matchedSkills,
        result.missingSkills,
        result.partialSkills,
        result.llmRelevanceScore
      )
      sendSseEvent(res, { type: 'result', data: { ...result, ...scoreResult } })
      sendSseEvent(res, { type: 'done' })
      res.end()
    })
  } catch (err) {
    sendSseEvent(res, { type: 'error', message: err.message })
    res.end()
  }
})

// POST /applications/:id/analysis/prep
analysisRouter.post('/applications/:id/analysis/prep', requireCsrf, rateLimitLlm, async (req, res, next) => {
  const limitCheck = await checkPrepRateLimit(req.user.id, req.params.id)
  if (!limitCheck.allowed) {
    return res.status(429).json({
      ok: false,
      error: {
        code: 'RATE_LIMIT',
        message: 'Interview prep generation limit reached (3/day for this application)',
      },
    })
  }

  let app
  try {
    app = await loadAppWithJd(req.params.id, req.user.id)
  } catch (err) {
    return next(err)
  }

  const resumeBlocks = await prisma.resumeBlock.findMany({
    where: { userId: req.user.id, archivedAt: null },
  })

  initSse(res)
  const userMessage = buildPrepPrompt(app.jd.structured, resumeBlocks)

  try {
    await streamLlm({
      systemPrompt: PREP_SYSTEM_PROMPT,
      userMessage,
      schema: PrepSchema,
      applicationId: app.id,
      kind: 'PREP',
      jdHash: app.jd.jdHash,
      resumeVersionId: undefined,
      promptVersion: PREP_VERSION,
    }, (token) => {
      sendSseEvent(res, { type: 'token', content: token })
    }, (result) => {
      sendSseEvent(res, { type: 'result', data: result })
      sendSseEvent(res, { type: 'done' })
      res.end()
    })
  } catch (err) {
    sendSseEvent(res, { type: 'error', message: err.message })
    res.end()
  }
})

// GET /applications/:id/analysis/latest
analysisRouter.get('/applications/:id/analysis/latest', asyncHandler(async (req, res) => {
  const app = await prisma.application.findUnique({ where: { id: req.params.id } })
  if (!app) {
    throw AppError.notFound('Application not found')
  }
  if (app.userId !== req.user.id) {
    throw AppError.forbidden('Forbidden')
  }

  const kind = req.query.kind || 'GAP'
  const latest = await prisma.analysis.findFirst({
    where: { applicationId: req.params.id, kind },
    orderBy: { createdAt: 'desc' },
  })
  if (!latest) {
    throw AppError.notFound('Latest analysis not found')
  }
  ok(res, latest)
}))
