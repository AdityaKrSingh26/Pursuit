import { describe, expect, it } from 'vitest'
import { CreateApplicationSchema } from '../modules/applications/applications.schemas.js'

const base = { company: 'Acme', roleTitle: 'Frontend Engineer' }

describe('CreateApplicationSchema', () => {
  it('rejects a card with neither URL nor pasted JD', () => {
    const result = CreateApplicationSchema.safeParse(base)
    expect(result.success).toBe(false)
  })

  it('accepts a job URL', () => {
    const result = CreateApplicationSchema.safeParse({
      ...base,
      url: 'https://jobs.example.com/123',
    })
    expect(result.success).toBe(true)
  })

  it('accepts pasted JD text', () => {
    const result = CreateApplicationSchema.safeParse({
      ...base,
      rawJd: 'Frontend Engineer\nAcme\nReact and TypeScript',
    })
    expect(result.success).toBe(true)
  })
})
