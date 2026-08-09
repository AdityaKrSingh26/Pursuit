import { Queue } from 'bullmq'
import { redis } from '../../lib/redis.js'

export const scoringQueue = new Queue('job-scoring', { connection: redis })
