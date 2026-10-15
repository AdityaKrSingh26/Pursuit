import { Queue } from 'bullmq'
import { redis } from '../../lib/redis.js'
import { DEFAULT_JOB_OPTIONS } from '../jobOptions.js'

export const pdfQueue = new Queue('pdf-render', {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})
