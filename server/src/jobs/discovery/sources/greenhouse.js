import { titleLooksRelevant, guessRemote } from './filters.js'
import { runInBatches } from './util.js'

export async function fetchJobs(companies) {
  const targets = companies.filter((c) => c.greenhouse_id)
  const results = await runInBatches(targets, 5, 500, (company) => fetchForCompany(company))
  return results.flat()
}

async function fetchForCompany(company) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company.greenhouse_id}/jobs?content=true`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (res.status === 404) return []
    if (!res.ok) return []
    const data = await res.json()
    const jobs = []
    for (const job of data.jobs ?? []) {
      const title = job.title ?? ''
      if (!titleLooksRelevant(title)) continue
      const location = job.location?.name ?? ''
      jobs.push({
        source: 'greenhouse',
        company: company.name,
        title,
        url: job.absolute_url,
        location,
        remote: guessRemote(location),
        description: (job.content ?? '').slice(0, 3000),
        techStack: [],
      })
    }
    return jobs
  } catch {
    return []
  }
}
