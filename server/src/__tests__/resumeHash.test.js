import { describe, expect, it } from 'vitest'
import { hashResumeBlocks } from '../lib/resumeHash.js'

const block = (over = {}) => ({
  id: 'b1',
  section: 'EXPERIENCE',
  content: 'Shipped the thing',
  skillTags: ['Go', 'SQL'],
  orderDefault: 0,
  ...over,
})

describe('hashResumeBlocks', () => {
  it('is stable for the same blocks regardless of array order', () => {
    const a = hashResumeBlocks([block({ id: 'a' }), block({ id: 'b', content: 'other' })])
    const b = hashResumeBlocks([block({ id: 'b', content: 'other' }), block({ id: 'a' })])
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('changes when a bullet is edited', () => {
    const before = hashResumeBlocks([block()])
    const after = hashResumeBlocks([block({ content: 'Shipped the thing, plus tests' })])
    expect(after).not.toBe(before)
  })
})
