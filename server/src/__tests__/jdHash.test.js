import { describe, it, expect } from 'vitest'
import { computeJdHash } from '../lib/jdHash.js'

describe('JD Hashing Unit Tests', () => {
  it('yields matching hashes for identical text with different whitespace and casing', () => {
    const textA = '  Software   Engineer  \n  Node.js '
    const textB = 'software engineer node.js'
    expect(computeJdHash(textA)).toBe(computeJdHash(textB))
  })

  it('yields different hashes for different texts', () => {
    const textA = 'Software Engineer'
    const textB = 'Hardware Engineer'
    expect(computeJdHash(textA)).not.toBe(computeJdHash(textB))
  })
})
