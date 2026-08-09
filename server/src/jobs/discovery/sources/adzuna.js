import { env } from '../../../lib/env.js'
import { titleLooksRelevant, guessRemote } from './filters.js'
import { sleep } from './util.js'

const COUNTRIES = ['in', 'gb', 'us', 'ca']
const PAGES_PER_COUNTRY = 2
const RESULTS_PER_PAGE = 50

// Global aggregator, needs Adzuna keys — gracefully skips if unset, same as job-radar.
export async function fetchJobs() {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
    console.log('[adzuna] ADZUNA_APP_ID/ADZUNA_APP_KEY not set, skipping')
    return []
  }

  const seenUrls = new Set()
  const jobs = []

  for (const country of COUNTRIES) {
    for (let page = 1; page <= PAGES_PER_COUNTRY; page++) {
      try {
        const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`)
        url.searchParams.set('app_id', env.ADZUNA_APP_ID)
        url.searchParams.set('app_key', env.ADZUNA_APP_KEY)
        url.searchParams.set('results_per_page', String(RESULTS_PER_PAGE))
        url.searchParams.set('what', 'software engineer OR backend engineer OR full stack')
        url.searchParams.set('what_exclude', 'senior manager director')
        url.searchParams.set('sort_by', 'date')

        const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) break
        const data = await res.json()

        for (const job of data.results ?? []) {
          const title = job.title ?? ''
          if (!titleLooksRelevant(title)) continue
          if (seenUrls.has(job.redirect_url)) continue
          seenUrls.add(job.redirect_url)
          const location = job.location?.display_name ?? ''
          jobs.push({
            source: 'adzuna',
            company: job.company?.display_name ?? 'Unknown',
            title,
            url: job.redirect_url,
            location,
            remote: guessRemote(location),
            description: job.description ?? '',
            techStack: [],
          })
        }

        await sleep(500)
      } catch {
        break
      }
    }
  }

  return jobs
}
