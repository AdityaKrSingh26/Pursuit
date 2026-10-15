import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'

export async function getResumeUploadForUser(userId, id) {
  const record = await prisma.resumeUpload.findUnique({ where: { id } })
  if (!record) throw AppError.notFound('Upload not found')
  if (record.userId !== userId) throw AppError.forbidden('Forbidden')
  return record
}

export async function getResumeVersionForUser(userId, id) {
  const version = await prisma.resumeVersion.findUnique({ where: { id } })
  if (!version) throw AppError.notFound('Resume version not found')
  if (version.userId !== userId) throw AppError.forbidden('Forbidden')
  return version
}
