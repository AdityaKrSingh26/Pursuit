import { describe, expect, it } from 'vitest'
import { resolveLlmModel } from '../lib/resolveLlmModel.js'

describe('resolveLlmModel', () => {
  it('rewrites retired Groq llama-3.3-70b-versatile to openai/gpt-oss-120b', () => {
    expect(
      resolveLlmModel({
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
      }),
    ).toBe('openai/gpt-oss-120b')
  })

  it('rewrites retired Groq llama-3.1-8b-instant to openai/gpt-oss-20b', () => {
    expect(
      resolveLlmModel({
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.1-8b-instant',
      }),
    ).toBe('openai/gpt-oss-20b')
  })

  it('leaves a current Groq model alone', () => {
    expect(
      resolveLlmModel({
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'openai/gpt-oss-120b',
      }),
    ).toBe('openai/gpt-oss-120b')
  })

  it('leaves non-Groq hosts alone even if the id is a retired Groq name', () => {
    expect(
      resolveLlmModel({
        baseUrl: 'https://api.openai.com/v1',
        model: 'llama-3.3-70b-versatile',
      }),
    ).toBe('llama-3.3-70b-versatile')
  })
})
