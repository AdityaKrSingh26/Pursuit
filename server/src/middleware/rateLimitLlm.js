import { redis } from '../lib/redis.js'

export async function rateLimitLlm(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
  }

  const userId = req.user.id
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const key = `ratelimit:llm:${userId}:${today}`

  try {
    const count = await redis.incr(key)
    if (count === 1) {
      const endOfDay = new Date()
      endOfDay.setUTCHours(23, 59, 59, 999)
      const expirySeconds = Math.max(0, Math.floor((endOfDay.getTime() - Date.now()) / 1000))
      await redis.expire(key, expirySeconds)
    }

    if (count > 30) {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT',
          message: 'LLM rate limit reached (30/day)'
        }
      })
    }

    next()
  } catch (err) {
    next(err)
  }
}
