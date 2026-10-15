import { Queue } from 'bullmq'
import { redis } from '../../lib/redis.js'
import { DEFAULT_JOB_OPTIONS } from '../jobOptions.js'

export const embeddingQueue = new Queue('jd-embedding', {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})
