import { prisma } from '../../lib/db.js'
import { generateToken, hashToken } from '../../lib/crypto.js'
import { AppError } from '../../lib/errors.js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function createRefreshToken(userId) {
  const raw = generateToken()
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    },
  })
  return raw
}

export async function rotateRefreshToken(raw) {
  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  })

  if (!token) throw AppError.unauthorized('Refresh token not found')

  if (token.revokedAt !== null) {
    await revokeFamily(token.userId)
    throw AppError.unauthorized('Refresh token reuse detected')
  }

  if (token.expiresAt < new Date()) throw AppError.unauthorized('Refresh token expired')

  // Create new first, then revoke old. Safe if DB fails mid-op.
  const newRaw = await createRefreshToken(token.userId)
  await prisma.refreshToken.update({
    where: { id: token.id },
    data: { revokedAt: new Date() },
  })

  return { raw: newRaw, userId: token.userId }
}

export async function revokeFamily(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
