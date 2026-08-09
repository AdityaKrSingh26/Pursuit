import { titleLooksRelevant } from './filters.js'
import { sleep } from './util.js'

const MAX_PAGES = 5

// Global aggregator, no auth.
export async function fetchJobs() {
  const seenSlugs = new Set()
  const jobs = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = `https://www.arbeitnow.com/api/job-board-api?page=${page}`
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (!res.ok) break
      const data = await res.json()
      const listings = data.data ?? []
      if (listings.length === 0) break

      for (const job of listings) {
        const title = job.title ?? ''
        if (!titleLooksRelevant(title)) continue
        if (seenSlugs.has(job.slug)) continue
        seenSlugs.add(job.slug)

        jobs.push({
          source: 'arbeitnow',
          company: job.company_name ?? 'Unknown',
          title,
          url: job.url ?? `https://www.arbeitnow.com/view/${job.slug}`,
          location: job.location || 'Germany',
          remote: Boolean(job.remote),
          description: job.description ?? '',
          techStack: job.tags ?? [],
        })
      }

      await sleep(300)
    } catch {
      break
    }
  }

  return jobs
}
