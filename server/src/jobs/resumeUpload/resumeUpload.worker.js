import { Worker } from 'bullmq'
import { redis } from '../../lib/redis.js'
import { resumeUploadProcessor } from './resumeUpload.processor.js'

export const resumeUploadWorker = new Worker('resume-upload', resumeUploadProcessor, {
  connection: redis,
  concurrency: 3,
})
