import { Worker } from 'bullmq'
import { redis } from '../../lib/redis.js'
import { remindersProcessor } from './reminders.processor.js'

export const remindersWorker = new Worker('reminders', remindersProcessor, {
  connection: redis,
  concurrency: 1,
})
