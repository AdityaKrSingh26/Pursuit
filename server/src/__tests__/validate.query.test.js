import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { validateQuery } from '../lib/validate.js'

function express5Req(query) {
  const req = {}
  Object.defineProperty(req, 'query', {
    configurable: true,
    enumerable: true,
    get() {
      return query
    },
  })
  return req
}

function run(schema, req) {
  let error = null
  let nextCalled = false
  validateQuery(schema)(req, {}, (err) => {
    if (err) error = err
    else nextCalled = true
  })
  return { error, nextCalled }
}

const ListQuery = z.object({
  stage: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

describe('validateQuery on Express 5 getter-only req.query', () => {
  it('coerces query strings onto req.query without throwing', () => {
    const req = express5Req({ stage: 'SAVED', limit: '50' })
    const { nextCalled, error } = run(ListQuery, req)
    expect(error).toBeNull()
    expect(nextCalled).toBe(true)
    expect(req.query).toEqual({ stage: 'SAVED', limit: 50 })
  })
})
