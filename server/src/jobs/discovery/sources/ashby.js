import { titleLooksRelevant, guessRemote } from './filters.js'
import { runInBatches } from './util.js'

export async function fetchJobs(companies) {
  const targets = companies.filter((c) => c.ashby_id)
  const results = await runInBatches(targets, 5, 500, (company) => fetchForCompany(company))
  return results.flat()
}

async function fetchForCompany(company) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${company.ashby_id}?includeCompensation=true`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (res.status === 404) return []
    if (!res.ok) return []
    const data = await res.json()
    const jobs = []
    for (const job of data.jobs ?? []) {
      const title = job.title ?? ''
      if (!titleLooksRelevant(title)) continue
      const location = job.locationName ?? ''
      jobs.push({
        source: 'ashby',
        company: company.name,
        title,
        url: job.jobPostingUrl,
        location,
        remote: Boolean(job.isRemote) || guessRemote(location),
        description: (job.descriptionPlain ?? job.description ?? '').slice(0, 3000),
        techStack: [],
      })
    }
    return jobs
  } catch {
    return []
  }
}
