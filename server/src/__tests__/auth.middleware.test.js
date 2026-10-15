import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db.js', () => ({
  prisma: {
    $executeRaw: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../lib/jwt.js', () => ({
  verifyAccessToken: vi.fn(() => ({ userId: 'user-1' })),
}))

import { prisma } from '../lib/db.js'
import { requireAuth } from '../middleware/auth.js'

function call(req) {
  return new Promise((resolve, reject) => {
    requireAuth(req, {}, (err) => (err ? reject(err) : resolve()))
  })
}

describe('requireAuth', () => {
  it('does not set a Postgres RLS GUC', async () => {
    await call({ cookies: { accessToken: 'tok' } })
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('attaches req.user from the access token', async () => {
    const req = { cookies: { accessToken: 'tok' } }
    await call(req)
    expect(req.user).toEqual({ id: 'user-1' })
  })
})
