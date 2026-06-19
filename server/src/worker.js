import { Queue } from 'bullmq'
import { redis } from './lib/redis.js'
import './jobs/ingestion/ingestion.worker.js'
import './jobs/pdf/pdf.worker.js'
import './jobs/embedding/embedding.worker.js'
import './jobs/reminders/reminders.worker.js'

console.log('Pursuit worker started')

const remindersQueue = new Queue('reminders', { connection: redis })
await remindersQueue.add(
  'daily-scan',
  {},
  {
    repeat: { cron: '0 8 * * *' },
    jobId: 'daily-reminders',
  }
)
