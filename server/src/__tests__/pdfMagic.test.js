import { describe, expect, it } from 'vitest'
import { isPdfBuffer } from '../lib/pdfMagic.js'

describe('isPdfBuffer', () => {
  it('accepts a buffer that starts with %PDF', () => {
    expect(isPdfBuffer(Buffer.from('%PDF-1.4\n%...'))).toBe(true)
  })

  it('rejects empty, short, or non-PDF bytes even if the MIME claimed PDF', () => {
    expect(isPdfBuffer(Buffer.from(''))).toBe(false)
    expect(isPdfBuffer(Buffer.from('%PD'))).toBe(false)
    expect(isPdfBuffer(Buffer.from('GIF89a'))).toBe(false)
  })
})
