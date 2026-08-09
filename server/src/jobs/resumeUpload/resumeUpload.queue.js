import { Queue } from 'bullmq'
import { redis } from '../../lib/redis.js'

export const resumeUploadQueue = new Queue('resume-upload', { connection: redis })
