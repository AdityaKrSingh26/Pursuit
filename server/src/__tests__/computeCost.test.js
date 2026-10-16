import { describe, expect, it } from 'vitest'
import { computeCost } from '../llm/llm.service.js'

const million = { input_tokens: 1_000_000, output_tokens: 1_000_000 }

describe('computeCost', () => {
  it('prices Groq openai/gpt-oss-120b at $0.15 in / $0.60 out per 1M', () => {
    expect(computeCost('openai/gpt-oss-120b', million)).toBeCloseTo(0.75)
  })

  it('prices Groq openai/gpt-oss-20b at $0.075 in / $0.30 out per 1M', () => {
    expect(computeCost('openai/gpt-oss-20b', million)).toBeCloseTo(0.375)
  })

  it('still prices claude sonnet', () => {
    expect(computeCost('claude-sonnet-4-6', million)).toBeCloseTo(18)
  })
})
