import { redis } from './redis.js'

// cache-aside: on miss compute fn(), store in Redis with TTL, return result
export async function cached(key, ttlSeconds, fn) {
  const hit = await redis.get(key)
  if (hit) return JSON.parse(hit)
  const result = await fn()
  await redis.setex(key, ttlSeconds, JSON.stringify(result))
  return result
}

export async function invalidate(...keys) {
  if (keys.length) await redis.del(...keys)
}

export const CacheKey = {
  funnelStats: (userId) => `dashboard:funnel:${userId}`,
  velocityStats: (userId) => `dashboard:velocity:${userId}`,
  skillDemand: (userId) => `intel:skill-demand:${userId}`,
  clusters: (userId) => `intel:clusters:${userId}`,
}
