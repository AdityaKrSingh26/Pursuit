import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { isPdfBuffer } from '../../lib/pdfMagic.js'
import { loadAppWithJd } from '../analysis/analysis.access.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { validateBody } from '../../lib/validate.js'
import { ok, created, noContent } from '../../lib/response.js'
import { initSse, sendSseEvent } from '../../lib/sse.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/db.js'
import { streamLlm } from '../../llm/llm.service.js'
import { SYSTEM_PROMPT, buildTailoringPrompt, VERSION } from '../../prompts/tailoring.js'
import { TailoringSchema } from '../../llm/schemas/tailoring.schema.js'
import { getSignedUrl } from '../../lib/storage.js'
import { resumePdfState } from './resumePdf.js'
import { getResumeUploadForUser, getResumeVersionForUser } from './resumeAccess.js'
import { upsertResumeVersion } from './resumeVersion.service.js'
import { hashResumeBlocks } from '../../lib/resumeHash.js'
import { extractPdfText } from '../../lib/pdfExtract.js'
import { resumeUploadQueue } from '../../jobs/resumeUpload/resumeUpload.queue.js'
import * as resumeService from './resumeBlocks.service.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
})

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
    z.object({
      blockId: z.string(),
      content: z.string(),
      section: z.string().min(1),
      skillTags: z.array(z.string()).default([]),
    })
  ).min(1),
})

resumeRouter.get('/resume/blocks', asyncHandler(async (req, res) => {
  ok(res, await resumeService.getBlocks(req.user.id, req.query.archived === 'true'))
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

resumeRouter.post('/resume/blocks/:id/restore', requireCsrf, asyncHandler(async (req, res) => {
  ok(res, await resumeService.restoreBlock(req.user.id, req.params.id))
}))

resumeRouter.post('/resume/upload', requireCsrf, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw AppError.badRequest('No PDF file uploaded')
  if (!isPdfBuffer(req.file.buffer)) throw AppError.badRequest('File is not a PDF')

  const rawText = (await extractPdfText(req.file.buffer)).trim()
  if (!rawText) throw AppError.badRequest('Could not extract any text from that PDF')

  const record = await prisma.resumeUpload.create({
    data: {
      userId: req.user.id,
      fileName: req.file.originalname,
      rawText,
      status: 'QUEUED',
    },
  })
  await resumeUploadQueue.add('parse', { resumeUploadId: record.id })

  created(res, { id: record.id, status: record.status })
}))

resumeRouter.get('/resume/uploads/:id', asyncHandler(async (req, res) => {
  const record = await getResumeUploadForUser(req.user.id, req.params.id)
  ok(res, {
    id: record.id,
    status: record.status,
    error: record.error,
    blocksCreated: record.blocksCreated,
  })
}))

// POST /applications/:id/tailor
resumeRouter.post('/applications/:id/tailor', requireCsrf, async (req, res, next) => {
  let app
  try {
    app = await loadAppWithJd(req.params.id, req.user.id)
  } catch (err) {
    return next(err)
  }

  const resumeBlocks = await prisma.resumeBlock.findMany({
    where: { userId: req.user.id, archivedAt: null },
    orderBy: [{ section: 'asc' }, { orderDefault: 'asc' }],
  })

  let sseStarted = false
  const ensureSse = () => {
    if (!sseStarted) {
      initSse(res)
      sseStarted = true
    }
  }
  const userMessage = buildTailoringPrompt(app.jd.structured, resumeBlocks)

  try {
    await streamLlm({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      schema: TailoringSchema,
      applicationId: app.id,
      kind: 'TAILOR',
      jdHash: app.jd.jdHash,
      resumeHash: hashResumeBlocks(resumeBlocks),
      resumeVersionId: undefined,
      promptVersion: VERSION,
      userId: req.user.id,
    }, (token) => {
      ensureSse()
      sendSseEvent(res, { type: 'token', content: token })
    }, (result) => {
      ensureSse()
      sendSseEvent(res, { type: 'result', data: result })
      sendSseEvent(res, { type: 'done' })
      res.end()
    })
  } catch (err) {
    if (!sseStarted) return next(err)
    sendSseEvent(res, { type: 'error', message: err.message })
    res.end()
  }
})

resumeRouter.post('/applications/:id/resume-version', requireCsrf, validateBody(ResumeVersionBodySchema), asyncHandler(async (req, res) => {
  const version = await upsertResumeVersion(req.user.id, req.params.id, req.body.approvedBlocks)
  created(res, { resumeVersionId: version.id })
}))

resumeRouter.get('/resume-versions/:id/pdf', asyncHandler(async (req, res) => {
  const version = await getResumeVersionForUser(req.user.id, req.params.id)

  const state = resumePdfState(version)
  if (state.kind === 'failed') {
    throw AppError.badRequest(state.error)
  }
  if (state.kind === 'rendering') {
    return res.status(202).json({ ok: true, data: { status: 'rendering' } })
  }

  const url = await getSignedUrl(state.pdfKey, 300)
  ok(res, { url, status: 'done' })
}))
