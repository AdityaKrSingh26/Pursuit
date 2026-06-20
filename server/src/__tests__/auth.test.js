import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../index.js'
import { prisma } from '../lib/db.js'

beforeEach(async () => {
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany()
})

beforeAll(async () => {
  await prisma.$connect()
})

const VALID_USER = { email: 'test@example.com', password: 'password123' }

async function register(overrides = {}) {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ ...VALID_USER, ...overrides })
}

async function login(overrides = {}) {
  return request(app)
    .post('/api/v1/auth/login')
    .send({ ...VALID_USER, ...overrides })
}

function extractCookie(res, name) {
  const raw = res.headers['set-cookie']
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : []
  const match = cookies.find((c) => c.startsWith(`${name}=`))
  return match?.split(';')[0].split('=')[1]
}

// Register

describe('POST /api/v1/auth/register', () => {
  it('returns 201 and user object without passwordHash', async () => {
    const res = await register()
    expect(res.status).toBe(201)
    expect(res.body.data.email).toBe(VALID_USER.email)
    expect(res.body.data.passwordHash).toBeUndefined()
  })

  it('sets accessToken, refreshToken, csrfToken cookies', async () => {
    const res = await register()
    const raw = res.headers['set-cookie']
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : []
    const names = cookies.map((c) => c.split('=')[0])
    expect(names).toContain('accessToken')
    expect(names).toContain('refreshToken')
    expect(names).toContain('csrfToken')
  })

  it('accessToken cookie is HttpOnly', async () => {
    const res = await register()
    const raw = res.headers['set-cookie']
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : []
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='))
    expect(accessCookie?.toLowerCase()).toContain('httponly')
  })

  it('returns 409 on duplicate email', async () => {
    await register()
    const res = await register()
    expect(res.status).toBe(409)
  })

  it('returns 400 on invalid email', async () => {
    const res = await register({ email: 'not-an-email' })
    expect(res.status).toBe(400)
  })

  it('returns 400 on short password', async () => {
    const res = await register({ password: 'short' })
    expect(res.status).toBe(400)
  })
})

// Login

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await register()
  })

  it('returns 200 with user object', async () => {
    const res = await login()
    expect(res.status).toBe(200)
    expect(res.body.data.email).toBe(VALID_USER.email)
  })

  it('sets auth cookies', async () => {
    const res = await login()
    const raw = res.headers['set-cookie']
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : []
    const names = cookies.map((c) => c.split('=')[0])
    expect(names).toContain('accessToken')
    expect(names).toContain('refreshToken')
  })

  it('returns 401 for wrong password', async () => {
    const res = await login({ password: 'wrongpassword' })
    expect(res.status).toBe(401)
  })

  it('returns 401 for unknown email (not 404)', async () => {
    const res = await login({ email: 'nobody@example.com' })
    expect(res.status).toBe(401)
  })
})

// Refresh

describe('POST /api/v1/auth/refresh', () => {
  it('returns 200 and new accessToken cookie', async () => {
    const loginRes = await register()
    const refreshToken = extractCookie(loginRes, 'refreshToken')

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`)

    expect(res.status).toBe(200)
    const newAccess = extractCookie(res, 'accessToken')
    expect(newAccess).toBeDefined()
    expect(newAccess?.split('.').length).toBe(3)
  })

  it('returns 401 on missing refresh token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh')
    expect(res.status).toBe(401)
  })

  it('returns 401 and revokes all tokens on refresh token reuse', async () => {
    const loginRes = await register()
    const refreshToken = extractCookie(loginRes, 'refreshToken')

    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`)

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`)

    expect(res.status).toBe(401)

    const active = await prisma.refreshToken.findMany({ where: { revokedAt: null } })
    expect(active).toHaveLength(0)
  })
})

// Logout

describe('POST /api/v1/auth/logout', () => {
  it('clears cookies and subsequent refresh returns 401', async () => {
    const loginRes = await register()
    const refreshToken = extractCookie(loginRes, 'refreshToken')

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `refreshToken=${refreshToken}`)

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`)

    expect(res.status).toBe(401)
  })
})

// CSRF

describe('CSRF protection', () => {
  it('blocks POST with mismatched csrf token', async () => {
    const { requireCsrf } = await import('../middleware/csrf.js')
    let errorPassed = null
    const mockReq = { method: 'POST', cookies: {}, headers: {} }
    requireCsrf(mockReq, {}, (err) => { errorPassed = err })
    expect(errorPassed?.statusCode).toBe(403)
  })

  it('passes GET requests without CSRF token', async () => {
    const { requireCsrf } = await import('../middleware/csrf.js')
    let nextCalled = false
    const mockReq = { method: 'GET', cookies: {}, headers: {} }
    requireCsrf(mockReq, {}, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
  })
})
