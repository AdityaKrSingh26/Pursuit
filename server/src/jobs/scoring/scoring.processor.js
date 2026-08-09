import { scoreJobsForUser, rescoreUserJobs } from '../../modules/jobs/jobs.service.js'

export async function scoringProcessor(job) {
  const { userId, rescore } = job.data
  const onProgress = (scored, total) => job.updateProgress(Math.round((scored / total) * 100))

  return rescore ? rescoreUserJobs(userId, onProgress) : scoreJobsForUser(userId, onProgress)
}
