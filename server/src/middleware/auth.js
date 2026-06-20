import { verifyAccessToken } from '../lib/jwt.js'
import { AppError } from '../lib/errors.js'

export function requireAuth(req, res, next) {
  const token = req.cookies?.accessToken
  if (!token) {
    return next(AppError.unauthorized())
  }
  try {
    const payload = verifyAccessToken(token)
    req.user = { id: payload.userId }
    next()
  } catch {
    next(AppError.unauthorized())
  }
}
