import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { prisma } from '../../lib/db.js'
import { chat } from '../../lib/llm.js'
import { env } from '../../lib/env.js'
import { buildScoringPrompt } from '../../prompts/job-scoring.js'
import { JobScoreSchema } from '../../llm/schemas/jobScore.schema.js'
import { guessRemote } from '../../jobs/discovery/sources/filters.js'
import { sleep } from '../../jobs/discovery/sources/util.js'
import * as yc from '../../jobs/discovery/sources/yc.js'
import * as greenhouse from '../../jobs/discovery/sources/greenhouse.js'
import * as lever from '../../jobs/discovery/sources/lever.js'
import * as ashby from '../../jobs/discovery/sources/ashby.js'
import * as remotive from '../../jobs/discovery/sources/remotive.js'
import * as adzuna from '../../jobs/discovery/sources/adzuna.js'
import * as wellfound from '../../jobs/discovery/sources/wellfound.js'
import * as arbeitnow from '../../jobs/discovery/sources/arbeitnow.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COMPANIES_PATH = join(__dirname, '../../data/companies.json')
const TINYFISH_BASE = 'https://agent.tinyfish.ai'
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

// Company-keyed sources hit a company's own ATS API; global sources aggregate across companies.
const COMPANY_KEYED_SOURCES = [greenhouse, lever, ashby]
const GLOBAL_SOURCES = [yc, remotive, adzuna, wellfound, arbeitnow]

// Job link patterns for common ATS platforms
const JOB_LINK_RE = /https?:\/\/[^\s"')>]+(?:lever\.co|greenhouse\.io|workable\.com|smartrecruiters\.com|ashbyhq\.com|jobs\.[^\s"')>]+|careers\.[^\s"')>]+)[^\s"')>]*/gi

export async function isStale() {
  const latest = await prisma.discoveredJob.findFirst({
    orderBy: { fetchedAt: 'desc' },
    select: { fetchedAt: true },
  })
  if (!latest) return true
  return Date.now() - latest.fetchedAt.getTime() > TWELVE_HOURS_MS
}

export async function getLastScanAt() {
  const latest = await prisma.discoveredJob.findFirst({
    orderBy: { fetchedAt: 'desc' },
    select: { fetchedAt: true },
  })
  return latest?.fetchedAt ?? null
}

export async function listJobs(userId) {
  const jobs = await prisma.discoveredJob.findMany({
    orderBy: { fetchedAt: 'desc' },
    include: {
      scores: {
        where: { userId },
        select: { score: true, scoreReason: true, scoredAt: true },
      },
    },
  })

  return jobs.map((j) => ({
    id: j.id,
    company: j.company,
    title: j.title,
    url: j.url,
    location: j.location,
    fetchedAt: j.fetchedAt,
    techStack: j.techStack,           // content property — on DiscoveredJob
    score: j.scores[0]?.score ?? null,
    scoreReason: j.scores[0]?.scoreReason ?? null,
    scoredAt: j.scores[0]?.scoredAt ?? null,
  }))
}

async function tinyfishFetch(url) {
  const res = await fetch(`${TINYFISH_BASE}/fetch?url=${encodeURIComponent(url)}&format=markdown`, {
    headers: { Authorization: `Bearer ${env.TINYFISH_API_KEY}` },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) return null
  return res.text()
}

function extractJobLinks(markdown, careersUrl) {
  const matches = markdown?.match(JOB_LINK_RE) ?? []
  // Deduplicate and filter out the base careers page itself
  return [...new Set(matches)].filter((u) => u !== careersUrl).slice(0, 20)
}

function extractTitle(markdown, company) {
  // Try to find a heading or first meaningful line as title
  const lines = (markdown ?? '').split('\n').map((l) => l.replace(/^#+\s*/, '').trim()).filter(Boolean)
  return lines[0]?.slice(0, 120) ?? `${company} Role`
}

function extractLocation(markdown) {
  const m = markdown?.match(/\b(Remote|Hybrid|On-?site|[A-Z][a-z]+(?:,\s*[A-Z]{2,})?)\b/)
  return m?.[0] ?? null
}

// Dedup identity for DiscoveredJob.url — trim + lowercase so case/whitespace
// variants of the same posting URL collapse into one row.
function normalizeUrl(url) {
  return url.trim().toLowerCase()
}

async function upsertDiscoveredJob(raw) {
  if (!raw.url) return
  const url = normalizeUrl(raw.url)
  const location = raw.location || null

  await prisma.discoveredJob.upsert({
    where: { url },
    create: {
      company: raw.company,
      title: raw.title,
      url,
      location,
      remote: Boolean(raw.remote),
      source: raw.source,
      rawText: (raw.description ?? '').slice(0, 8000),
      techStack: raw.techStack ?? [],
    },
    // Never touch score-related fields on re-scrape — only refresh content.
    update: {
      title: raw.title,
      location,
      remote: Boolean(raw.remote),
      source: raw.source,
      rawText: (raw.description ?? '').slice(0, 8000),
      techStack: raw.techStack ?? [],
      fetchedAt: new Date(),
    },
  })
}

// Companies without a known ATS id fall through to the TinyFish markdown-scrape fallback.
function tinyfishFallbackCompanies(companies) {
  return companies.filter((c) => !c.greenhouse_id && !c.lever_id && !c.ashby_id)
}

async function scanTinyfishCompany(company, rawJobs) {
  const careersMarkdown = await tinyfishFetch(company.careers_url)
  if (!careersMarkdown) return

  const jobLinks = extractJobLinks(careersMarkdown, company.careers_url)

  for (const url of jobLinks) {
    // Skip if already fetched recently
    const existing = await prisma.discoveredJob.findUnique({
      where: { url: normalizeUrl(url) },
      select: { fetchedAt: true },
    })
    if (existing && Date.now() - existing.fetchedAt.getTime() < TWELVE_HOURS_MS) continue

    const jobMarkdown = await tinyfishFetch(url)
    if (!jobMarkdown) continue

    const location = extractLocation(jobMarkdown) ?? ''
    rawJobs.push({
      source: 'tinyfish',
      company: company.name,
      title: extractTitle(jobMarkdown, company.name),
      url,
      location,
      remote: guessRemote(location),
      description: jobMarkdown,
      techStack: [],
    })

    // Respect TinyFish rate limit: 25 fetches/min
    await sleep(2500)
  }
}

// Called by the BullMQ worker — scans all sources and upserts jobs.
export async function runDiscoveryScan(onProgress) {
  const raw = await readFile(COMPANIES_PATH, 'utf8')
  const companies = JSON.parse(raw)
  const rawJobs = []

  // Phase 1: structured-API sources, run in parallel
  const fastResults = await Promise.allSettled([
    ...COMPANY_KEYED_SOURCES.map((s) => s.fetchJobs(companies)),
    ...GLOBAL_SOURCES.map((s) => s.fetchJobs()),
  ])
  for (const result of fastResults) {
    if (result.status === 'fulfilled') rawJobs.push(...result.value)
    else console.error('[discovery] source failed:', result.reason)
  }

  // Phase 2: TinyFish fallback, sequential, only for companies with no ATS id
  const tinyfishCompanies = tinyfishFallbackCompanies(companies)
  const totalUnits = tinyfishCompanies.length + 1
  onProgress?.(1, totalUnits)

  for (let i = 0; i < tinyfishCompanies.length; i++) {
    try {
      await scanTinyfishCompany(tinyfishCompanies[i], rawJobs)
    } catch {
      // Skip failed companies silently
    }
    onProgress?.(i + 2, totalUnits)
  }

  // Phase 3: save
  for (const job of rawJobs) {
    await upsertDiscoveredJob(job)
  }
}

function extractJsonArray(text) {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']') + 1
  if (start === -1 || end === 0) return null
  try {
    return JSON.parse(text.slice(start, end))
  } catch {
    return null
  }
}

async function callScoringModel(prompt) {
  const { text } = await chat({
    system: 'You are a job-fit evaluator. Output only valid JSON.',
    messages: [{ role: 'user', content: prompt }],
    model: env.LLM_MODEL,
    maxTokens: 1500,
  })
  return text
}

// Scores one batch, validating the LLM's output against JobScoreSchema with a single retry on failure.
async function scoreBatchWithRetry(prompt) {
  const text = await callScoringModel(prompt)
  let result = JobScoreSchema.safeParse(extractJsonArray(text))
  if (result.success) return result.data

  const errorMsg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
  const retryText = await callScoringModel(`${prompt}\n\nPrevious attempt was invalid: ${errorMsg}. Fix and return valid JSON.`)
  result = JobScoreSchema.safeParse(extractJsonArray(retryText))
  if (!result.success) {
    console.error('[job-scoring] batch invalid after retry:', result.error.message)
    return null
  }
  return result.data
}

// Score all unscored jobs for a given user
export async function scoreJobsForUser(userId, onProgress) {
  const resumeBlocks = await prisma.resumeBlock.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ section: 'asc' }, { orderDefault: 'asc' }],
  })

  if (!resumeBlocks.length) return { scored: 0 }

  const resumeText = resumeBlocks.map((b) => `[${b.section}]\n${b.content}`).join('\n\n')

  // Find jobs not yet scored by this user
  const scoredIds = await prisma.userJobScore
    .findMany({ where: { userId }, select: { discoveredJobId: true } })
    .then((rows) => rows.map((r) => r.discoveredJobId))

  const unscored = await prisma.discoveredJob.findMany({
    where: scoredIds.length ? { id: { notIn: scoredIds } } : {},
    orderBy: { fetchedAt: 'desc' },
  })

  if (!unscored.length) return { scored: 0 }

  const BATCH = 10
  let totalScored = 0

  for (let i = 0; i < unscored.length; i += BATCH) {
    const batch = unscored.slice(i, i + BATCH)
    const prompt = buildScoringPrompt(resumeText, batch)
    const results = await scoreBatchWithRetry(prompt)

    if (results) {
      for (const r of results) {
        const job = batch[r.job_number - 1]
        if (!job) continue
        const clampedScore = Math.min(100, Math.max(0, r.score))

        // tech_stack is content of the job, not user-specific — store on DiscoveredJob
        if (r.tech_stack.length > 0) {
          await prisma.discoveredJob.update({ where: { id: job.id }, data: { techStack: r.tech_stack } })
        }

        await prisma.userJobScore.upsert({
          where: { userId_discoveredJobId: { userId, discoveredJobId: job.id } },
          create: { userId, discoveredJobId: job.id, score: clampedScore, scoreReason: r.score_reason },
          update: { score: clampedScore, scoreReason: r.score_reason, scoredAt: new Date() },
        })
        totalScored++
      }
    }

    onProgress?.(Math.min(i + BATCH, unscored.length), unscored.length)
  }

  return { scored: totalScored }
}

// Clears a user's existing scores and re-runs scoring against their current resume blocks.
export async function rescoreUserJobs(userId, onProgress) {
  await prisma.userJobScore.deleteMany({ where: { userId } })
  return scoreJobsForUser(userId, onProgress)
}
