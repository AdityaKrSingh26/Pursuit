import { Queue } from 'bullmq'
import { redis } from '../../lib/redis.js'

export const discoveryQueue = new Queue('job-discovery', { connection: redis })
