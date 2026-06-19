import { Worker } from 'bullmq'
import { redis } from '../../lib/redis.js'
import { embeddingProcessor } from './embeddingProcessor.js'

export const embeddingWorker = new Worker('jd-embedding', embeddingProcessor, {
  connection: redis,
  concurrency: 2,
})
