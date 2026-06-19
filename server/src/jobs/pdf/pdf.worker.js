import { Worker } from 'bullmq'
import { redis } from '../../lib/redis.js'
import { pdfProcessor } from './pdfProcessor.js'

export const pdfWorker = new Worker('pdf-render', pdfProcessor, {
  connection: redis,
  concurrency: 2,
})

pdfWorker.on('failed', (job, err) => {
  console.error(`[pdf-worker] job ${job?.id} failed:`, err.message)
})
