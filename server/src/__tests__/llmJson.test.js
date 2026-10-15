import { describe, expect, it } from 'vitest'
import { parseJsonFromLlm } from '../lib/llmJson.js'

describe('parseJsonFromLlm', () => {
  it('parses a bare JSON object', () => {
    expect(parseJsonFromLlm('{"foo":1}')).toEqual({ foo: 1 })
  })

  it('strips markdown fences before parsing', () => {
    expect(parseJsonFromLlm('```json\n{"foo":1}\n```')).toEqual({ foo: 1 })
    expect(parseJsonFromLlm('```\n{"bar":true}\n```')).toEqual({ bar: true })
  })

  it('returns null for empty or invalid text', () => {
    expect(parseJsonFromLlm('')).toBeNull()
    expect(parseJsonFromLlm('not json')).toBeNull()
  })
})
