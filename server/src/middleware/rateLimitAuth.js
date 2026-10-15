import { redis } from '../lib/redis.js'
import { AppError } from '../lib/errors.js'

// Atomic INCR + EXPIRE. Fail closed: if Redis is down, auth returns 503
// rather than letting brute-force traffic through.
const ATOMIC_INCR = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`

const WINDOW_SECONDS = 15 * 60

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function normalizedEmail(req) {
  return String(req.body?.email || '').trim().toLowerCase() || 'missing'
}

async function increment(key) {
  return redis.eval(ATOMIC_INCR, 1, key, WINDOW_SECONDS)
}

function createAuthRateLimiter({ action, max }) {
  return async function rateLimitAuth(req, _res, next) {
    try {
      const ipCount = await increment(`ratelimit:auth:${action}:ip:${clientIp(req)}`)
      if (ipCount > max) {
        return next(AppError.tooManyRequests())
      }
      const emailCount = await increment(`ratelimit:auth:${action}:email:${normalizedEmail(req)}`)
      if (emailCount > max) {
        return next(AppError.tooManyRequests())
      }
      next()
    } catch (err) {
      if (err instanceof AppError) return next(err)
      return next(AppError.serviceUnavailable('Authentication temporarily unavailable'))
    }
  }
}

export const rateLimitLogin = createAuthRateLimiter({ action: 'login', max: 10 })
export const rateLimitRegister = createAuthRateLimiter({ action: 'register', max: 20 })
