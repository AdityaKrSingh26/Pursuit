import { titleLooksRelevant } from './filters.js'

const MARKUP_LINE_RE = /^\s*(<!doctype|<\/?[a-z][\s>=])/i

export function isHtmlTitle(title) {
  return /^\s*</.test(title ?? '')
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function looksLikeHtmlDocument(text) {
  return /^\s*(<!doctype|<html[\s>])/i.test(text ?? '')
}

function firstInner(text, tag) {
  const m = text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!m) return null
  const value = stripTags(m[1]).slice(0, 120)
  if (!value || isHtmlTitle(value)) return null
  return value
}

export function extractTitle(markdown, _company) {
  const text = markdown ?? ''
  if (!text.trim()) return null

  if (looksLikeHtmlDocument(text)) {
    const fromTitle = firstInner(text, 'title')
    if (fromTitle) return fromTitle
    const fromH1 = firstInner(text, 'h1')
    if (fromH1) return fromH1
  }

  const lines = text
    .split('\n')
    .map((l) => stripTags(l.replace(/^#+\s*/, '').trim()))
    .filter(Boolean)
    .filter((l) => !MARKUP_LINE_RE.test(l))

  const relevant = lines.find((l) => titleLooksRelevant(l))
  return relevant ? relevant.slice(0, 120) : null
}

export function isUsableDiscoveryTitle(title) {
  return Boolean(title) && !isHtmlTitle(title) && titleLooksRelevant(title)
}
