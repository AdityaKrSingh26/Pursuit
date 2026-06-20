import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { rateLimitLlm } from '../../middleware/rateLimitLlm.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { validateBody } from '../../lib/validate.js'
import { ok, created, noContent } from '../../lib/response.js'
import { initSse, sendSseEvent } from '../../lib/sse.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/db.js'
import { streamLlm } from '../../llm/llm.service.js'
import { SYSTEM_PROMPT, buildTailoringPrompt, VERSION } from '../../prompts/tailoring.js'
import { TailoringSchema } from '../../llm/schemas/tailoring.schema.js'
import { pdfQueue } from '../../jobs/pdf/pdf.queue.js'
import { getSignedUrl } from '../../lib/storage.js'
import * as resumeService from './resumeBlocks.service.js'

export const resumeRouter = Router()
resumeRouter.use(requireAuth)

const CreateBlockSchema = z.object({
  section: z.string().min(1),
  content: z.string().min(1),
  skillTags: z.array(z.string()).default([]),
  orderDefault: z.number().int().default(0),
})

const UpdateBlockSchema = z.object({
  content: z.string().optional(),
  skillTags: z.array(z.string()).optional(),
  orderDefault: z.number().int().optional(),
})

const ReorderSchema = z.object({
  updates: z.array(z.object({ id: z.string(), orderDefault: z.number().int() })).min(1),
})

const ResumeVersionBodySchema = z.object({
  approvedBlocks: z.array(
    z.object({ blockId: z.string(), content: z.string() })
  ).min(1),
})

resumeRouter.get('/resume/blocks', asyncHandler(async (req, res) => {
  ok(res, await resumeService.getBlocks(req.user.id))
}))

resumeRouter.post('/resume/blocks', requireCsrf, validateBody(CreateBlockSchema), asyncHandler(async (req, res) => {
  created(res, await resumeService.createBlock(req.user.id, req.body))
}))

// must come before /:id
resumeRouter.post('/resume/blocks/reorder', requireCsrf, validateBody(ReorderSchema), asyncHandler(async (req, res) => {
  await resumeService.reorderBlocks(req.user.id, req.body.updates)
  noContent(res)
}))

resumeRouter.patch('/resume/blocks/:id', requireCsrf, validateBody(UpdateBlockSchema), asyncHandler(async (req, res) => {
  ok(res, await resumeService.updateBlock(req.user.id, req.params.id, req.body))
}))

resumeRouter.delete('/resume/blocks/:id', requireCsrf, asyncHandler(async (req, res) => {
  await resumeService.archiveBlock(req.user.id, req.params.id)
  noContent(res)
}))

// POST /applications/:id/tailor
resumeRouter.post('/applications/:id/tailor', requireCsrf, rateLimitLlm, async (req, res, next) => {
  let app
  try {
    app = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { jd: true },
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

  const resumeBlocks = await prisma.resumeBlock.findMany({
    where: { userId: req.user.id, archivedAt: null },
    orderBy: [{ section: 'asc' }, { orderDefault: 'asc' }],
  })

  initSse(res)
  const userMessage = buildTailoringPrompt(app.jd.structured, resumeBlocks)

  try {
    await streamLlm({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      schema: TailoringSchema,
      applicationId: app.id,
      kind: 'TAILOR',
      jdHash: app.jd.jdHash,
      resumeVersionId: undefined,
      promptVersion: VERSION,
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

resumeRouter.post('/applications/:id/resume-version', requireCsrf, validateBody(ResumeVersionBodySchema), asyncHandler(async (req, res) => {
  const app = await prisma.application.findUnique({ where: { id: req.params.id } })
  if (!app) {
    throw AppError.notFound('Application not found')
  }
  if (app.userId !== req.user.id) {
    throw AppError.forbidden('Forbidden')
  }

  const version = await prisma.resumeVersion.create({
    data: {
      userId: req.user.id,
      applicationId: app.id,
      blocksSnapshot: req.body.approvedBlocks,
    },
  })

  await pdfQueue.add('render', {
    resumeVersionId: version.id,
    userId: req.user.id,
  })

  created(res, { resumeVersionId: version.id })
}))

resumeRouter.get('/resume-versions/:id/pdf', asyncHandler(async (req, res) => {
  const version = await prisma.resumeVersion.findUnique({ where: { id: req.params.id } })
  if (!version) {
    throw AppError.notFound('Resume version not found')
  }
  if (version.userId !== req.user.id) {
    throw AppError.forbidden('Forbidden')
  }

  if (!version.pdfKey) {
    return res.status(202).json({ ok: true, data: { status: 'rendering' } })
  }

  const url = await getSignedUrl(version.pdfKey, 300)
  ok(res, { url })
}))
