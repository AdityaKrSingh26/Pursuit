// Ported from job-radar's backend/scrapers/base.py — the quality gate every
// scraped job title passes through before it's saved, so junk never reaches
// the LLM scorer.

export const ROLE_KEYWORDS = [
  'software engineer',
  'backend engineer',
  'backend developer',
  'full stack',
  'fullstack',
  'platform engineer',
  'sde',
  'swe',
  'ai engineer',
  'ml engineer',
  'developer',
  'software developer',
]

const EXCLUDE_TITLE_RE = /\b(senior|staff|principal|lead|manager|director|vp|head of|10\+|8\+ years|7\+ years|6\+ years|5\+ years)\b/i

export function titleLooksRelevant(title) {
  const lower = (title ?? '').toLowerCase()
  if (EXCLUDE_TITLE_RE.test(lower)) return false
  return ROLE_KEYWORDS.some((kw) => lower.includes(kw))
}

export function guessRemote(location) {
  return (location ?? '').toLowerCase().includes('remote')
}
