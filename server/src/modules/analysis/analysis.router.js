import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { rateLimitLlm } from '../../middleware/rateLimitLlm.js'
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

function sendSseEvent(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

// POST /applications/:id/analysis/gap
analysisRouter.post('/applications/:id/analysis/gap', requireCsrf, rateLimitLlm, async (req, res, next) => {
  let app
  try {
    app = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { jd: true }
    })
    if (!app) {
      throw AppError.notFound('Application not found')
    }
    if (app.userId !== req.user.id) {
      throw AppError.forbidden('Forbidden')
    }
    if (!app.jd || app.jd.parseStatus !== 'DONE') {
      throw AppError.badRequest('Job description not parsed yet')
    }
  } catch (err) {
    return next(err)
  }

  // Load user's resume blocks
  const resumeBlocks = await prisma.resumeBlock.findMany({
    where: { userId: req.user.id, archivedAt: null }
  })

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    'Connection': 'keep-alive',
  })
  res.flushHeaders()

  const userMessage = buildGapPrompt(app.jd.structured, resumeBlocks)

  try {
    await streamLlm({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      schema: GapAnalysisSchema,
      applicationId: app.id,
      kind: 'GAP',
      jdHash: app.jd.jdHash,
      resumeVersionId: undefined, // default
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
      error: {
        code: 'RATE_LIMIT',
        message: 'Interview prep generation limit reached (3/day for this application)'
      },
      remaining: 0
    })
  }

  let app
  try {
    app = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { jd: true }
    })
    if (!app) {
      throw AppError.notFound('Application not found')
    }
    if (app.userId !== req.user.id) {
      throw AppError.forbidden('Forbidden')
    }
    if (!app.jd || app.jd.parseStatus !== 'DONE') {
      throw AppError.badRequest('Job description not parsed yet')
    }
  } catch (err) {
    return next(err)
  }

  // Load user's resume blocks
  const resumeBlocks = await prisma.resumeBlock.findMany({
    where: { userId: req.user.id, archivedAt: null }
  })

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    'Connection': 'keep-alive',
  })
  res.flushHeaders()

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
analysisRouter.get('/applications/:id/analysis/latest', async (req, res, next) => {
  try {
    const app = await prisma.application.findUnique({
      where: { id: req.params.id }
    })
    if (!app) {
      throw AppError.notFound('Application not found')
    }
    if (app.userId !== req.user.id) {
      throw AppError.forbidden('Forbidden')
    }

    const kind = req.query.kind || 'GAP'
    const latest = await prisma.analysis.findFirst({
      where: { applicationId: req.params.id, kind },
      orderBy: { createdAt: 'desc' }
    })
    if (!latest) {
      throw AppError.notFound('Latest analysis not found')
    }
    res.json(latest)
  } catch (err) {
    next(err)
  }
})
