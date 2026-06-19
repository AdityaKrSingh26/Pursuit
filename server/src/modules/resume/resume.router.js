import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { rateLimitLlm } from '../../middleware/rateLimitLlm.js'
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

// ─── Block schemas ────────────────────────────────────────────────────────────

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

// ─── Resume block routes ──────────────────────────────────────────────────────

// GET /resume/blocks
resumeRouter.get('/resume/blocks', async (req, res, next) => {
  try {
    res.json(await resumeService.getBlocks(req.user.id))
  } catch (err) { next(err) }
})

// POST /resume/blocks
resumeRouter.post('/resume/blocks', requireCsrf, async (req, res, next) => {
  try {
    const parsed = CreateBlockSchema.safeParse(req.body)
    if (!parsed.success) throw AppError.badRequest(parsed.error.issues[0].message)
    res.status(201).json(await resumeService.createBlock(req.user.id, parsed.data))
  } catch (err) { next(err) }
})

// POST /resume/blocks/reorder  (must come before /:id)
resumeRouter.post('/resume/blocks/reorder', requireCsrf, async (req, res, next) => {
  try {
    const parsed = ReorderSchema.safeParse(req.body)
    if (!parsed.success) throw AppError.badRequest(parsed.error.issues[0].message)
    await resumeService.reorderBlocks(req.user.id, parsed.data.updates)
    res.status(204).end()
  } catch (err) { next(err) }
})

// PATCH /resume/blocks/:id
resumeRouter.patch('/resume/blocks/:id', requireCsrf, async (req, res, next) => {
  try {
    const parsed = UpdateBlockSchema.safeParse(req.body)
    if (!parsed.success) throw AppError.badRequest(parsed.error.issues[0].message)
    res.json(await resumeService.updateBlock(req.user.id, req.params.id, parsed.data))
  } catch (err) { next(err) }
})

// DELETE /resume/blocks/:id
resumeRouter.delete('/resume/blocks/:id', requireCsrf, async (req, res, next) => {
  try {
    await resumeService.archiveBlock(req.user.id, req.params.id)
    res.status(204).end()
  } catch (err) { next(err) }
})

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sendSseEvent(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

// ─── Tailoring routes ─────────────────────────────────────────────────────────

// POST /applications/:id/tailor
resumeRouter.post('/applications/:id/tailor', requireCsrf, rateLimitLlm, async (req, res, next) => {
  let app
  try {
    app = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { jd: true },
    })
    if (!app) throw AppError.notFound('Application not found')
    if (app.userId !== req.user.id) throw AppError.forbidden('Forbidden')
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

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    'Connection': 'keep-alive',
  })
  res.flushHeaders()

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

// POST /applications/:id/resume-version
const ResumeVersionBodySchema = z.object({
  approvedBlocks: z.array(
    z.object({ blockId: z.string(), content: z.string() })
  ).min(1),
})

resumeRouter.post('/applications/:id/resume-version', requireCsrf, async (req, res, next) => {
  try {
    const parsed = ResumeVersionBodySchema.safeParse(req.body)
    if (!parsed.success) throw AppError.badRequest(parsed.error.issues[0].message)

    const app = await prisma.application.findUnique({ where: { id: req.params.id } })
    if (!app) throw AppError.notFound('Application not found')
    if (app.userId !== req.user.id) throw AppError.forbidden('Forbidden')

    const version = await prisma.resumeVersion.create({
      data: {
        userId: req.user.id,
        applicationId: app.id,
        blocksSnapshot: parsed.data.approvedBlocks,
      },
    })

    await pdfQueue.add('render', {
      resumeVersionId: version.id,
      userId: req.user.id,
    })

    res.status(201).json({ resumeVersionId: version.id })
  } catch (err) { next(err) }
})

// GET /resume-versions/:id/pdf
resumeRouter.get('/resume-versions/:id/pdf', async (req, res, next) => {
  try {
    const version = await prisma.resumeVersion.findUnique({ where: { id: req.params.id } })
    if (!version) throw AppError.notFound('Resume version not found')
    if (version.userId !== req.user.id) throw AppError.forbidden('Forbidden')

    if (!version.pdfKey) {
      return res.status(202).json({ status: 'rendering' })
    }

    const url = await getSignedUrl(version.pdfKey, 300)
    res.json({ url })
  } catch (err) { next(err) }
})
