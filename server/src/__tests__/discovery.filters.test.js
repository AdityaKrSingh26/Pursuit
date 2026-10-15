import { describe, expect, it } from 'vitest'
import { titleLooksRelevant } from '../jobs/discovery/sources/filters.js'

describe('titleLooksRelevant', () => {
  it('keeps senior, staff, principal, and lead software titles', () => {
    expect(titleLooksRelevant('Senior Software Engineer')).toBe(true)
    expect(titleLooksRelevant('Staff Platform Engineer')).toBe(true)
    expect(titleLooksRelevant('Principal Backend Engineer')).toBe(true)
    expect(titleLooksRelevant('Lead Full Stack Engineer')).toBe(true)
  })

  it('matches frontend and mobile engineering titles', () => {
    expect(titleLooksRelevant('Frontend Engineer')).toBe(true)
    expect(titleLooksRelevant('Front-End Developer')).toBe(true)
    expect(titleLooksRelevant('iOS Engineer')).toBe(true)
    expect(titleLooksRelevant('Android Developer')).toBe(true)
    expect(titleLooksRelevant('React Native Engineer')).toBe(true)
    expect(titleLooksRelevant('Mobile Engineer')).toBe(true)
  })

  it('still drops manager and director titles', () => {
    expect(titleLooksRelevant('Engineering Manager')).toBe(false)
    expect(titleLooksRelevant('Director of Engineering')).toBe(false)
    expect(titleLooksRelevant('VP of Engineering')).toBe(false)
  })
})
