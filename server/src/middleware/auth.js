import { verifyAccessToken } from '../lib/jwt.js'
import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/db.js'

export function requireAuth(req, res, next) {
  const token = req.cookies?.accessToken
  if (!token) {
    return next(AppError.unauthorized())
  }
  try {
    const payload = verifyAccessToken(token)
    req.user = { id: payload.userId }
    // Set RLS context so PostgreSQL tenant_isolation policies activate.
    // This is fire-and-forget — we don't await so latency is near-zero,
    // and RLS is defense-in-depth on top of the WHERE userId = ? filters.
    prisma.$executeRaw`SELECT set_config('app.current_user_id', ${payload.userId}, true)`.catch(() => {})
    next()
  } catch {
    next(AppError.unauthorized())
  }
}
