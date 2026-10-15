import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'
import { pdfQueue } from '../../jobs/pdf/pdf.queue.js'

function snapshotBlocks(blocks) {
  return blocks.map((b) => ({
    blockId: b.blockId,
    section: b.section,
    content: b.content,
    skillTags: b.skillTags ?? [],
  }))
}

export async function upsertResumeVersion(userId, applicationId, blocks) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId, deletedAt: null },
  })
  if (!app) throw AppError.notFound('Application not found')

  const blocksSnapshot = snapshotBlocks(blocks)

  const version = await prisma.resumeVersion.upsert({
    where: { applicationId },
    create: {
      userId,
      applicationId,
      blocksSnapshot,
      renderStatus: 'PENDING',
    },
    update: {
      blocksSnapshot,
      pdfKey: null,
      renderStatus: 'PENDING',
      renderError: null,
    },
  })

  await pdfQueue.add('render', {
    resumeVersionId: version.id,
    userId,
  })

  return version
}
