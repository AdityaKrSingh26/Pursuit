import { Queue } from 'bullmq'
import { redis } from '../../lib/redis.js'
import { DEFAULT_JOB_OPTIONS } from '../jobOptions.js'

export const ingestionQueue = new Queue('jd-ingestion', {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})
