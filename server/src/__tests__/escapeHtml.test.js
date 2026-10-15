import { describe, expect, it } from 'vitest'
import { escapeHtml } from '../jobs/pdf/pdfRenderer.js'

describe('escapeHtml', () => {
  it('escapes markup so a bullet cannot inject HTML in the puppeteer fallback', () => {
    expect(escapeHtml('</p><h1>owned</h1>')).toBe('&lt;/p&gt;&lt;h1&gt;owned&lt;/h1&gt;')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })
})
