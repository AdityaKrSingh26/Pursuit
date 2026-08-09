import { titleLooksRelevant } from './filters.js'

const CATEGORIES = ['software-dev', 'devops-sysadmin', 'backend']

// Global, remote-only job board.
export async function fetchJobs() {
  const seenUrls = new Set()
  const jobs = []

  for (const category of CATEGORIES) {
    try {
      const url = `https://remotive.com/api/remote-jobs?category=${category}&limit=100`
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (!res.ok) continue
      const data = await res.json()
      for (const job of data.jobs ?? []) {
        const title = job.title ?? ''
        if (!titleLooksRelevant(title)) continue
        if (seenUrls.has(job.url)) continue
        seenUrls.add(job.url)
        jobs.push({
          source: 'remotive',
          company: job.company_name,
          title,
          url: job.url,
          location: job.candidate_required_location ?? '',
          remote: true,
          description: job.description ?? '',
          techStack: job.tags ?? [],
        })
      }
    } catch {
      // skip category on failure
    }
  }

  return jobs
}
