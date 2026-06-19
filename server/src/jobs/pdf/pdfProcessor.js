import { prisma } from '../../lib/db.js'
import { renderResumePdf, renderResumePdfFallback } from './pdfRenderer.js'
import { uploadBuffer } from '../../lib/storage.js'

export async function pdfProcessor(job) {
  const { resumeVersionId, userId } = job.data

  const version = await prisma.resumeVersion.findUnique({
    where: { id: resumeVersionId },
  })
  if (!version) throw new Error(`ResumeVersion ${resumeVersionId} not found`)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (!user) throw new Error(`User ${userId} not found`)

  const blocks = Array.isArray(version.blocksSnapshot)
    ? version.blocksSnapshot
    : JSON.parse(version.blocksSnapshot)

  let buffer
  try {
    buffer = await renderResumePdf(blocks, { email: user.email })
  } catch (err) {
    console.warn('[pdfProcessor] Primary renderer failed, trying fallback:', err.message)
    buffer = await renderResumePdfFallback(blocks, { email: user.email })
  }

  const pdfKey = `resumes/${userId}/${resumeVersionId}.pdf`
  await uploadBuffer(pdfKey, buffer, 'application/pdf')

  await prisma.resumeVersion.update({
    where: { id: resumeVersionId },
    data: { pdfKey },
  })
}
