import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { hashPassword, verifyPassword, hashToken } from '../../lib/crypto.js'
import { signAccessToken } from '../../lib/jwt.js'
import { AppError } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { validateBody } from '../../lib/validate.js'
import { ok, created } from '../../lib/response.js'
import { generateCsrfToken } from '../../middleware/csrf.js'
import { requireAuth } from '../../middleware/auth.js'
import { createRefreshToken, rotateRefreshToken, revokeFamily } from './refreshToken.service.js'
import { rateLimitLogin, rateLimitRegister } from '../../middleware/rateLimitAuth.js'

export const authRouter = Router()

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const COOKIE_BASE = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
}

const ACCESS_COOKIE_OPTS = {
  ...COOKIE_BASE,
  httpOnly: true,
  maxAge: 15 * 60 * 1000,
}

const REFRESH_COOKIE_OPTS = {
  ...COOKIE_BASE,
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

const CSRF_COOKIE_OPTS = {
  ...COOKIE_BASE,
  httpOnly: false, // JS-readable so client can attach as x-csrf-token header
  maxAge: REFRESH_COOKIE_OPTS.maxAge,
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTS)
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS)
  res.cookie('csrfToken', generateCsrfToken(), CSRF_COOKIE_OPTS)
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken', { ...COOKIE_BASE, httpOnly: true })
  res.clearCookie('refreshToken', { ...COOKIE_BASE, httpOnly: true })
  res.clearCookie('csrfToken', { ...COOKIE_BASE, httpOnly: false })
}

authRouter.post('/register', validateBody(credentialsSchema), rateLimitRegister, asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw AppError.conflict('Email already registered')
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { email, passwordHash } })

  const rawRefresh = await createRefreshToken(user.id)
  setAuthCookies(res, signAccessToken(user.id), rawRefresh)
  created(res, { id: user.id, email: user.email })
}))

authRouter.post('/login', validateBody(credentialsSchema), rateLimitLogin, asyncHandler(async (req, res) => {
  const { email, password } = req.body
  // Always 401, never reveal whether the email exists
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw AppError.unauthorized('Invalid credentials')
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    throw AppError.unauthorized('Invalid credentials')
  }

  const rawRefresh = await createRefreshToken(user.id)
  setAuthCookies(res, signAccessToken(user.id), rawRefresh)
  ok(res, { id: user.id, email: user.email })
}))

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const raw = req.cookies?.refreshToken
  if (!raw) {
    throw AppError.unauthorized('No refresh token')
  }

  const { raw: newRaw, userId } = await rotateRefreshToken(raw)
  res.cookie('accessToken', signAccessToken(userId), ACCESS_COOKIE_OPTS)
  res.cookie('refreshToken', newRaw, REFRESH_COOKIE_OPTS)
  res.cookie('csrfToken', generateCsrfToken(), CSRF_COOKIE_OPTS)
  ok(res, { ok: true })
}))

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true },
  })
  if (!user) {
    throw AppError.unauthorized()
  }
  ok(res, user)
}))

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const raw = req.cookies?.refreshToken
  if (raw) {
    const token = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(raw) },
    })
    if (token) {
      await revokeFamily(token.userId)
    }
  }
  clearAuthCookies(res)
  ok(res, { ok: true })
}))
