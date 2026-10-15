import { randomBytes, timingSafeEqual } from 'crypto'
import { AppError } from '../lib/errors.js'

export function generateCsrfToken() {
  return randomBytes(16).toString('hex')
}

export function csrfTokensMatch(headerToken, cookieToken) {
  if (typeof headerToken !== 'string' || typeof cookieToken !== 'string') return false
  const left = Buffer.from(headerToken)
  const right = Buffer.from(cookieToken)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function requireCsrf(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }
  const headerToken = req.headers['x-csrf-token']
  const cookieToken = req.cookies?.csrfToken
  if (!csrfTokensMatch(headerToken, cookieToken)) {
    return next(AppError.forbidden('CSRF token mismatch'))
  }
  next()
}
