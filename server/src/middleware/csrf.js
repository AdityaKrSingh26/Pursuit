import { randomBytes } from 'crypto'
import { AppError } from '../lib/errors.js'

export function generateCsrfToken() {
  return randomBytes(16).toString('hex')
}

export function requireCsrf(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }
  const headerToken = req.headers['x-csrf-token']
  const cookieToken = req.cookies?.csrfToken
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return next(AppError.forbidden('CSRF token mismatch'))
  }
  next()
}
