import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/redis.js', () => ({
  redis: {
    eval: vi.fn(),
  },
}))

import { redis } from '../lib/redis.js'
import { rateLimitLogin, rateLimitRegister } from '../middleware/rateLimitAuth.js'

function mockReq(overrides = {}) {
  return {
    ip: '203.0.113.10',
    body: { email: 'User@Example.com' },
    ...overrides,
  }
}

function run(mw, req) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
  const next = vi.fn()
  return mw(req, res, next).then(() => ({ res, next }))
}

describe('rateLimitLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls next() when IP and email are under 10 attempts', async () => {
    redis.eval.mockResolvedValue(1)
    const { next } = await run(rateLimitLogin, mockReq())
    expect(next).toHaveBeenCalledOnce()
    expect(next.mock.calls[0][0]).toBeUndefined()
  })

  it('returns 429 when the IP exceeds 10 login attempts in 15 minutes', async () => {
    redis.eval.mockImplementation(async (_script, _n, key) => (
      String(key).includes(':ip:') ? 11 : 1
    ))
    const { next } = await run(rateLimitLogin, mockReq())
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 429,
      code: 'RATE_LIMIT',
    }))
  })

  it('returns 429 when the email exceeds 10 login attempts in 15 minutes', async () => {
    redis.eval.mockImplementation(async (_script, _n, key) => (
      String(key).includes(':email:') ? 11 : 1
    ))
    const { next } = await run(rateLimitLogin, mockReq())
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429 }))
  })

  it('uses a generic 429 message that does not mention the email', async () => {
    redis.eval.mockResolvedValue(11)
    const { next } = await run(rateLimitLogin, mockReq())
    const err = next.mock.calls[0][0]
    expect(err.message.toLowerCase()).not.toContain('user@example.com')
    expect(err.message.toLowerCase()).not.toContain('email')
  })

  it('fails closed with 503 when Redis is down', async () => {
    redis.eval.mockRejectedValue(new Error('ECONNREFUSED'))
    const { next } = await run(rateLimitLogin, mockReq())
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
    }))
  })
})

describe('rateLimitRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows 20 attempts from one IP', async () => {
    redis.eval.mockResolvedValue(20)
    const { next } = await run(rateLimitRegister, mockReq())
    expect(next.mock.calls[0][0]).toBeUndefined()
  })

  it('returns 429 on the 21st register attempt from one IP', async () => {
    redis.eval.mockImplementation(async (_script, _n, key) => (
      String(key).includes(':ip:') ? 21 : 1
    ))
    const { next } = await run(rateLimitRegister, mockReq())
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429 }))
  })
})
