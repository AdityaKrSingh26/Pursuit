import { redis } from '../../lib/redis.js'

export async function checkPrepRateLimit(userId, applicationId) {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const key = `ratelimit:prep:${userId}:${applicationId}:${today}`

  const count = await redis.incr(key)
  if (count === 1) {
    const endOfDay = new Date()
    endOfDay.setUTCHours(23, 59, 59, 999)
    const expirySeconds = Math.max(0, Math.floor((endOfDay.getTime() - Date.now()) / 1000))
    await redis.expire(key, expirySeconds)
  }

  const limit = 3
  const allowed = count <= limit
  const remaining = Math.max(0, limit - count)

  return { allowed, remaining }
}
