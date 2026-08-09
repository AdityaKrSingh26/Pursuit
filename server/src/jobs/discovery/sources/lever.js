import { titleLooksRelevant, guessRemote } from './filters.js'
import { runInBatches } from './util.js'

export async function fetchJobs(companies) {
  const targets = companies.filter((c) => c.lever_id)
  const results = await runInBatches(targets, 5, 500, (company) => fetchForCompany(company))
  return results.flat()
}

async function fetchForCompany(company) {
  const url = `https://api.lever.co/v0/postings/${company.lever_id}?mode=json`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (res.status === 404) return []
    if (!res.ok) return []
    const postings = await res.json()
    const jobs = []
    for (const job of postings ?? []) {
      const title = job.text ?? ''
      if (!titleLooksRelevant(title)) continue
      const location = job.categories?.location ?? ''
      const commitment = job.categories?.commitment ?? ''
      jobs.push({
        source: 'lever',
        company: company.name,
        title,
        url: job.hostedUrl,
        location,
        remote: guessRemote(location) || guessRemote(commitment),
        description: (job.descriptionPlain ?? '').slice(0, 3000),
        techStack: [],
      })
    }
    return jobs
  } catch {
    return []
  }
}
