import { titleLooksRelevant, guessRemote } from './filters.js'

const YC_API = 'https://www.workatastartup.com/api/companies'
const PAGE_LIMIT = 50

// Global source, not company-keyed — every YC-backed startup's open eng roles.
export async function fetchJobs() {
  const jobs = []
  let page = 1

  while (true) {
    let data
    try {
      const res = await fetch(YC_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'eng', page, limit: PAGE_LIMIT }),
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) break
      data = await res.json()
    } catch {
      break
    }

    const companies = data.companies ?? []
    for (const company of companies) {
      for (const job of company.jobs ?? []) {
        const title = job.title ?? ''
        if (!titleLooksRelevant(title)) continue
        const location = job.location ?? company.location ?? ''
        jobs.push({
          source: 'yc',
          company: company.name,
          title,
          url: job.url ?? job.apply_url,
          location,
          remote: guessRemote(location) || Boolean(job.remote),
          description: job.description ?? '',
          techStack: [],
        })
      }
    }

    if (companies.length < PAGE_LIMIT) break
    page++
  }

  return jobs
}
