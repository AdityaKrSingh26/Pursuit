import { createReadStream } from 'fs'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { prisma } from '../../lib/db.js'
import { chat } from '../../lib/llm.js'
import { env } from '../../lib/env.js'
import { buildScoringPrompt } from '../../prompts/job-scoring.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COMPANIES_PATH = join(__dirname, '../../data/companies.json')
const TINYFISH_BASE = 'https://agent.tinyfish.ai'
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

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
        select: { score: true, scoreReason: true, techStack: true, scoredAt: true },
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

// Called by the BullMQ worker — scans all companies and upserts jobs
export async function runDiscoveryScan(onProgress) {
  const raw = await readFile(COMPANIES_PATH, 'utf8')
  const companies = JSON.parse(raw)
  let processed = 0

  for (const company of companies) {
    try {
      const careersMarkdown = await tinyfishFetch(company.careers_url)
      if (!careersMarkdown) { processed++; onProgress?.(processed, companies.length); continue }

      const jobLinks = extractJobLinks(careersMarkdown, company.careers_url)

      for (const url of jobLinks) {
        // Skip if already fetched recently
        const existing = await prisma.discoveredJob.findUnique({ where: { url }, select: { fetchedAt: true } })
        if (existing && Date.now() - existing.fetchedAt.getTime() < TWELVE_HOURS_MS) continue

        const jobMarkdown = await tinyfishFetch(url)
        if (!jobMarkdown) continue

        await prisma.discoveredJob.upsert({
          where: { url },
          create: {
            company: company.name,
            title: extractTitle(jobMarkdown, company.name),
            url,
            location: extractLocation(jobMarkdown),
            rawText: jobMarkdown.slice(0, 8000),
          },
          update: {
            title: extractTitle(jobMarkdown, company.name),
            location: extractLocation(jobMarkdown),
            rawText: jobMarkdown.slice(0, 8000),
            fetchedAt: new Date(),
          },
        })

        // Respect TinyFish rate limit: 25 fetches/min
        await new Promise((r) => setTimeout(r, 2500))
      }
    } catch {
      // Skip failed companies silently
    }

    processed++
    onProgress?.(processed, companies.length)
  }
}

// Score all unscored jobs for a given user
export async function scoreJobsForUser(userId) {
  const resumeBlocks = await prisma.resumeBlock.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ section: 'asc' }, { orderDefault: 'asc' }],
  })

  if (!resumeBlocks.length) return { scored: 0 }

  const resumeText = resumeBlocks
    .map((b) => `[${b.section}]\n${b.content}`)
    .join('\n\n')

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
    try {
      const prompt = buildScoringPrompt(resumeText, batch)
      const { text } = await chat({
        system: 'You are a job-fit evaluator. Output only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        model: env.LLM_MODEL,
        maxTokens: 1500,
      })

      const start = text.indexOf('[')
      const end = text.lastIndexOf(']') + 1
      if (start === -1 || end === 0) continue

      const results = JSON.parse(text.slice(start, end))

      for (const r of results) {
        const job = batch[r.job_number - 1]
        if (!job) continue
        const clampedScore = Math.min(100, Math.max(0, r.score ?? 0))
        const techStack = r.tech_stack ?? []

        // techStack is content of the job, not user-specific — store on DiscoveredJob
        if (techStack.length > 0) {
          await prisma.discoveredJob.update({
            where: { id: job.id },
            data: { techStack },
          })
        }

        await prisma.userJobScore.upsert({
          where: { userId_discoveredJobId: { userId, discoveredJobId: job.id } },
          create: {
            userId,
            discoveredJobId: job.id,
            score: clampedScore,
            scoreReason: r.score_reason ?? '',
          },
          update: {
            score: clampedScore,
            scoreReason: r.score_reason ?? '',
            scoredAt: new Date(),
          },
        })
        totalScored++
      }
    } catch {
      // Skip failed batch
    }
  }

  return { scored: totalScored }
}
