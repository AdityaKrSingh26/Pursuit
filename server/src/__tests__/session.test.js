import { describe, expect, it } from 'vitest'
import { sessionAfterMeFailure, sessionFromMe } from '../../../client/src/lib/session.ts'

describe('session helpers', () => {
  it('clears user and csrf when /auth/me fails', () => {
    expect(sessionAfterMeFailure()).toEqual({ user: null, csrfToken: null })
  })

  it('stores the user and current csrf cookie on success', () => {
    const user = { id: 'u1', email: 'a@b.com' }
    expect(sessionFromMe(user, 'csrf-abc')).toEqual({ user, csrfToken: 'csrf-abc' })
  })
})
