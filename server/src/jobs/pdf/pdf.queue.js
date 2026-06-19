import { Queue } from 'bullmq'
import { redis } from '../../lib/redis.js'

export const pdfQueue = new Queue('pdf-render', { connection: redis })
