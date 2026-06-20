import { runDiscoveryScan } from '../../modules/jobs/jobs.service.js'

export async function discoveryProcessor(job) {
  await runDiscoveryScan((processed, total) => {
    job.updateProgress(Math.round((processed / total) * 100))
  })
}
