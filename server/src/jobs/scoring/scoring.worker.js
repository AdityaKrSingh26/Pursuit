import { Worker } from 'bullmq'
import { redis } from '../../lib/redis.js'
import { scoringProcessor } from './scoring.processor.js'

export const scoringWorker = new Worker('job-scoring', scoringProcessor, {
  connection: redis,
  concurrency: 1,
})
