import { titleLooksRelevant, guessRemote } from './filters.js'

const SEARCH_URLS = [
  'https://wellfound.com/role/l/software-engineer',
  'https://wellfound.com/role/l/backend-engineer',
  'https://wellfound.com/role/l/full-stack-engineer',
  'https://wellfound.com/role/r/software-engineer',
]

const NEXT_DATA_RE = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// No official API — scrapes the embedded Apollo GraphQL cache out of the page's __NEXT_DATA__ blob.
export async function fetchJobs() {
  const seenUrls = new Set()
  const jobs = []

  for (const searchUrl of SEARCH_URLS) {
    try {
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const match = html.match(NEXT_DATA_RE)
      if (!match) continue

      const data = JSON.parse(match[1])
      const apolloState = data?.props?.pageProps?.apolloState ?? {}

      for (const [key, value] of Object.entries(apolloState)) {
        if (!key.startsWith('StartupRole:')) continue
        const title = value.title ?? ''
        if (!titleLooksRelevant(title)) continue

        const jobUrl = value.applyUrl ?? value.jobUrl ?? `https://wellfound.com${value.slug ?? ''}`
        if (seenUrls.has(jobUrl)) continue
        seenUrls.add(jobUrl)

        const company = value.startup?.name ?? 'Unknown'
        const location = Array.isArray(value.locationNames) ? value.locationNames.join(', ') : ''

        jobs.push({
          source: 'wellfound',
          company,
          title,
          url: jobUrl,
          location,
          remote: Boolean(value.remote) || guessRemote(location),
          description: value.description ?? '',
          techStack: [],
        })
      }
    } catch {
      // skip this search URL on failure
    }
  }

  return jobs
}
