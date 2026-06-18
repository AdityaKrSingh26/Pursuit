import IORedis from 'ioredis'
import { env } from './env.js'

// maxRetriesPerRequest: null is required by BullMQ
export const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
