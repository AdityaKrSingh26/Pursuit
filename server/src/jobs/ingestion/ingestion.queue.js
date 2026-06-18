import { Queue } from 'bullmq'
import { redis } from '../../lib/redis.js'

export const ingestionQueue = new Queue('jd-ingestion', { connection: redis })
