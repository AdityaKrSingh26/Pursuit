import { describe, it, expect } from 'vitest'
import { computeMatchScore } from '../llm/scoring.js'

describe('Scoring Formula Unit Tests', () => {
  it('handles perfect overlaps (all matched, 0 missing/partial)', () => {
    const matched = ['React', 'Node', 'TypeScript']
    const missing = []
    const partial = []
    const result = computeMatchScore(matched, missing, partial, 100)

    expect(result.skillOverlapPct).toBe(100)
    expect(result.matchScore).toBe(100)
  })

  it('handles absolute zero overlaps (all missing, 0 matched/partial)', () => {
    const matched = []
    const missing = ['Kubernetes', 'Go']
    const partial = []
    const result = computeMatchScore(matched, missing, partial, 0)

    expect(result.skillOverlapPct).toBe(0)
    expect(result.matchScore).toBe(0)
  })

  it('correctly blends 50/50 splits and LLM scores', () => {
    const matched = ['React', 'CSS']
    const missing = ['Node', 'Docker']
    const partial = []
    const result = computeMatchScore(matched, missing, partial, 70)

    // overlap = 2 / (2 + 2) = 0.5 (50%)
    // matchScore = 0.6 * 50 + 0.4 * 70 = 30 + 28 = 58
    expect(result.skillOverlapPct).toBe(50)
    expect(result.matchScore).toBe(58)
  })
})
