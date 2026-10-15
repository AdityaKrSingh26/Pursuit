import { describe, expect, it } from 'vitest'
import {
  extractTitle,
  isHtmlTitle,
  isUsableDiscoveryTitle,
} from '../jobs/discovery/sources/tinyfishParse.js'

const HTML_JOB = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Senior Frontend Engineer | Acme Labs</title>
</head>
<body>
  <h1>Senior Frontend Engineer</h1>
  <p>We are hiring.</p>
</body>
</html>`

const HTML_H1_ONLY = `<!DOCTYPE html>
<html>
<body><h1>Staff Platform Engineer</h1></body>
</html>`

const HTML_NO_TITLE = `<!DOCTYPE html>
<html><head></head><body><div>nav</div></body></html>`

describe('isHtmlTitle', () => {
  it('flags doctype and tag soup as junk titles', () => {
    expect(isHtmlTitle('<!DOCTYPE html>')).toBe(true)
    expect(isHtmlTitle('<!DOCTYPE html>\n<html><head>')).toBe(true)
    expect(isHtmlTitle('<html lang="en">')).toBe(true)
    expect(isHtmlTitle('<div class="job">Frontend Engineer</div>')).toBe(true)
  })

  it('leaves plain job titles alone', () => {
    expect(isHtmlTitle('Frontend Engineer')).toBe(false)
    expect(isHtmlTitle('Senior Software Engineer | Acme')).toBe(false)
  })
})

describe('extractTitle', () => {
  it('reads <title> from an HTML document TinyFish failed to convert', () => {
    expect(extractTitle(HTML_JOB, 'Acme Labs')).toBe('Senior Frontend Engineer | Acme Labs')
  })

  it('falls back to <h1> when <title> is missing', () => {
    expect(extractTitle(HTML_H1_ONLY, 'Acme Labs')).toBe('Staff Platform Engineer')
  })

  it('returns null when the HTML blob has no title or heading', () => {
    expect(extractTitle(HTML_NO_TITLE, 'Acme Labs')).toBeNull()
    expect(extractTitle('<!DOCTYPE html>', 'Acme Labs')).toBeNull()
  })

  it('strips markdown headings', () => {
    expect(extractTitle('# iOS Engineer\n\nWe are hiring.', 'Acme Labs')).toBe('iOS Engineer')
  })

  it('skips nav chrome and picks the first role-like line', () => {
    const md = ['Skip to content', 'Home', '# Frontend Engineer', 'About the role'].join('\n')
    expect(extractTitle(md, 'Acme Labs')).toBe('Frontend Engineer')
  })

  it('skips markup lines even when they sit above a real heading', () => {
    const mixed = ['<!DOCTYPE html>', '<html>', '# React Native Engineer', 'Build apps.'].join('\n')
    expect(extractTitle(mixed, 'Acme Labs')).toBe('React Native Engineer')
  })
})

describe('isUsableDiscoveryTitle', () => {
  it('rejects HTML leftovers and manager titles', () => {
    expect(isUsableDiscoveryTitle('<!DOCTYPE html>')).toBe(false)
    expect(isUsableDiscoveryTitle('Engineering Manager')).toBe(false)
    expect(isUsableDiscoveryTitle('Acme Labs Role')).toBe(false)
    expect(isUsableDiscoveryTitle(null)).toBe(false)
  })

  it('keeps the same role titles the ATS sources keep', () => {
    expect(isUsableDiscoveryTitle('Frontend Engineer')).toBe(true)
    expect(isUsableDiscoveryTitle('Senior Software Engineer | Acme Labs')).toBe(true)
  })
})
