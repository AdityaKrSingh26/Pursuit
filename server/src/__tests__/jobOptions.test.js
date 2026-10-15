import { describe, expect, it } from 'vitest'
import { DEFAULT_JOB_OPTIONS } from '../jobs/jobOptions.js'

describe('DEFAULT_JOB_OPTIONS', () => {
  it('retries three times with exponential backoff from 2s', () => {
    expect(DEFAULT_JOB_OPTIONS).toEqual({
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    })
  })
})
