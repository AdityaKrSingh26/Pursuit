import { Queue, Worker } from 'bullmq'
import { redis } from './lib/redis.js'
import { prisma } from './lib/db.js'
import './jobs/ingestion/ingestion.worker.js'
import './jobs/discovery/discovery.worker.js'
import './jobs/pdf/pdf.worker.js'
import './jobs/embedding/embedding.worker.js'
import './jobs/reminders/reminders.worker.js'

console.log('Pursuit worker started')

const remindersQueue = new Queue('reminders', { connection: redis })
await remindersQueue.add(
  'daily-scan',
  {},
  { repeat: { cron: '0 8 * * *' }, jobId: 'daily-reminders' }
)

// Refresh materialized view every 15 minutes for dashboard funnel stats
const dashboardQueue = new Queue('dashboard-refresh', { connection: redis })
new Worker('dashboard-refresh', async () => {
  await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_funnel`
}, { connection: redis })
await dashboardQueue.add(
  'refresh-funnel',
  {},
  { repeat: { every: 15 * 60 * 1000 }, jobId: 'funnel-refresh' }
)
