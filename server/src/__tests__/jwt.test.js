import { describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'
import { signAccessToken, verifyAccessToken } from '../lib/jwt.js'

const SECRET = process.env.JWT_SECRET

describe('verifyAccessToken', () => {
  it('accepts HS256 access tokens', () => {
    const token = signAccessToken('user-1')
    expect(verifyAccessToken(token).userId).toBe('user-1')
  })

  it('rejects tokens signed with a different HMAC algorithm', () => {
    const token = jwt.sign({ userId: 'user-1' }, SECRET, { algorithm: 'HS384' })
    expect(() => verifyAccessToken(token)).toThrow()
  })
})
