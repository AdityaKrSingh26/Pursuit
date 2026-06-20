import { Worker } from 'bullmq'
import { redis } from '../../lib/redis.js'
import { discoveryProcessor } from './discovery.processor.js'

export const discoveryWorker = new Worker('job-discovery', discoveryProcessor, {
  connection: redis,
  concurrency: 1,
})
