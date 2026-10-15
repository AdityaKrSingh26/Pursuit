import { describe, expect, it } from 'vitest'
import { requireCsrf } from '../middleware/csrf.js'

function run(req) {
  let error = null
  let nextCalled = false
  requireCsrf(req, {}, (err) => {
    if (err) error = err
    else nextCalled = true
  })
  return { error, nextCalled }
}

describe('requireCsrf', () => {
  it('passes GET without tokens', () => {
    const { nextCalled, error } = run({ method: 'GET', cookies: {}, headers: {} })
    expect(nextCalled).toBe(true)
    expect(error).toBeNull()
  })

  it('rejects POST when header and cookie differ', () => {
    const { error } = run({
      method: 'POST',
      cookies: { csrfToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      headers: { 'x-csrf-token': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    })
    expect(error?.statusCode).toBe(403)
  })

  it('rejects POST when token lengths differ', () => {
    const { error } = run({
      method: 'POST',
      cookies: { csrfToken: 'short' },
      headers: { 'x-csrf-token': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    })
    expect(error?.statusCode).toBe(403)
  })

  it('passes POST when header and cookie match', () => {
    const token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const { nextCalled, error } = run({
      method: 'POST',
      cookies: { csrfToken: token },
      headers: { 'x-csrf-token': token },
    })
    expect(nextCalled).toBe(true)
    expect(error).toBeNull()
  })
})
