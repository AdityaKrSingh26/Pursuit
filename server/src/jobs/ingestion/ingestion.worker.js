import { Worker } from 'bullmq'
import { redis } from '../../lib/redis.js'
import { ingestionProcessor } from './processor.js'

export const ingestionWorker = new Worker('jd-ingestion', ingestionProcessor, {
  connection: redis,
  concurrency: 3,
})
