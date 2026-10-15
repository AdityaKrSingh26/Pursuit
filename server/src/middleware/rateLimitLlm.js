import { redis } from '../lib/redis.js'
import { AppError } from '../lib/errors.js'

// Atomic INCR + conditional EXPIRE in a single round-trip to avoid a race where
// the key is incremented but the process dies before EXPIRE is set.
const ATOMIC_INCR = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`

export async function consumeLlmQuota(userId) {
  const today = new Date().toISOString().split('T')[0]
  const key = `ratelimit:llm:${userId}:${today}`

  const endOfDay = new Date()
  endOfDay.setUTCHours(23, 59, 59, 999)
  const expirySeconds = Math.max(1, Math.floor((endOfDay.getTime() - Date.now()) / 1000))

  const count = await redis.eval(ATOMIC_INCR, 1, key, expirySeconds)
  if (count > 30) {
    throw AppError.tooManyRequests('LLM rate limit reached (30/day)')
  }
}

export async function rateLimitLlm(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
  }

  try {
    await consumeLlmQuota(req.user.id)
    next()
  } catch (err) {
    next(err)
  }
}
