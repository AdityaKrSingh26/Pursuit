import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { hashPassword, verifyPassword, hashToken } from '../../lib/crypto.js'
import { signAccessToken } from '../../lib/jwt.js'
import { AppError } from '../../lib/errors.js'
import { generateCsrfToken } from '../../middleware/csrf.js'
import { createRefreshToken, rotateRefreshToken, revokeFamily } from './refreshToken.service.js'

export const authRouter = Router()

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000,
}

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTS)
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS)
  res.cookie('csrfToken', generateCsrfToken(), {
    ...REFRESH_COOKIE_OPTS,
    httpOnly: false, // JS-readable so client can attach as x-csrf-token header
  })
}

// POST /api/v1/auth/register
authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body)
    if (!parsed.success) throw AppError.badRequest(parsed.error.issues[0].message)

    const { email, password } = parsed.data
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw AppError.conflict('Email already registered')

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({ data: { email, passwordHash } })

    const rawRefresh = await createRefreshToken(user.id)
    setAuthCookies(res, signAccessToken(user.id), rawRefresh)
    res.status(201).json({ id: user.id, email: user.email })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body)
    if (!parsed.success) throw AppError.badRequest(parsed.error.issues[0].message)

    const { email, password } = parsed.data
    // Always 401 — never reveal whether the email exists
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw AppError.unauthorized('Invalid credentials')

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) throw AppError.unauthorized('Invalid credentials')

    const rawRefresh = await createRefreshToken(user.id)
    setAuthCookies(res, signAccessToken(user.id), rawRefresh)
    res.json({ id: user.id, email: user.email })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/auth/refresh
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const raw = req.cookies?.refreshToken
    if (!raw) throw AppError.unauthorized('No refresh token')

    const { raw: newRaw, userId } = await rotateRefreshToken(raw)
    res.cookie('accessToken', signAccessToken(userId), ACCESS_COOKIE_OPTS)
    res.cookie('refreshToken', newRaw, REFRESH_COOKIE_OPTS)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/auth/logout
authRouter.post('/logout', async (req, res, next) => {
  try {
    const raw = req.cookies?.refreshToken
    if (raw) {
      const token = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(raw) },
      })
      if (token) await revokeFamily(token.userId)
    }
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken')
    res.clearCookie('csrfToken')
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
