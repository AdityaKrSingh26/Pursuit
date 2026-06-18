import crypto from 'crypto'

export function computeJdHash(rawText) {
  const normalized = rawText.replace(/\s+/g, ' ').trim().toLowerCase()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}
