import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import { prisma } from '../../../lib/db.js'
import { remindersProcessor } from '../../../jobs/reminders/reminders.processor.js'

beforeAll(async () => {
  await prisma.$connect()
})

beforeEach(async () => {
  await prisma.reminder.deleteMany()
  await prisma.stageEvent.deleteMany()
  await prisma.application.deleteMany()
  await prisma.user.deleteMany()
})

function extractCookie(res, name) {
  const raw = res.headers['set-cookie']
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : []
  const match = cookies.find((c) => c.startsWith(`${name}=`))
  return match?.split(';')[0].split('=')[1]
}

async function getAuthData(email, password = 'password123') {
  const res = await request(app).post('/api/v1/auth/register').send({ email, password })
  const accessToken = extractCookie(res, 'accessToken')
  const csrfToken = extractCookie(res, 'csrfToken')
  return {
    userId: res.body.id,
    accessToken,
    csrfToken,
    cookies: `accessToken=${accessToken}; csrfToken=${csrfToken}`,
  }
}

describe('Reminders Integration Tests', () => {
  it('correctly creates, updates, and dismisses reminders', async () => {
    const user = await getAuthData('stale@example.com')

    const now = new Date()
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    // App 1: stale. APPLIED, created 10 days ago, no stage events newer than 7 days
    const appStale = await prisma.application.create({
      data: {
        userId: user.userId,
        company: 'Stale Co',
        roleTitle: 'Software Engineer',
        stage: 'APPLIED',
        createdAt: tenDaysAgo,
      },
    })
    await prisma.stageEvent.create({
      data: {
        applicationId: appStale.id,
        fromStage: 'SAVED',
        toStage: 'APPLIED',
        at: tenDaysAgo,
      },
    })

    // App 2: not stale. APPLIED, created today
    const appFresh = await prisma.application.create({
      data: {
        userId: user.userId,
        company: 'Fresh Co',
        roleTitle: 'Frontend Engineer',
        stage: 'APPLIED',
        createdAt: now,
      },
    })

    // App 3: fresh due to recent event
    const appFreshEvent = await prisma.application.create({
      data: {
        userId: user.userId,
        company: 'Fresh Event Co',
        roleTitle: 'Backend Engineer',
        stage: 'APPLIED',
        createdAt: tenDaysAgo,
      },
    })
    await prisma.stageEvent.create({
      data: {
        applicationId: appFreshEvent.id,
        fromStage: 'SAVED',
        toStage: 'APPLIED',
        at: twoDaysAgo,
      },
    })

    // Run processor
    await remindersProcessor()

    // Query pending reminders via API
    const resPending = await request(app)
      .get('/api/v1/reminders/pending')
      .set('Cookie', user.cookies)
      .expect(200)

    expect(resPending.body).toBeDefined()
    expect(resPending.body.length).toBe(1)
    expect(resPending.body[0].application.company).toBe('Stale Co')

    // Run processor again — should be idempotent
    await remindersProcessor()

    const resPending2 = await request(app)
      .get('/api/v1/reminders/pending')
      .set('Cookie', user.cookies)
      .expect(200)
    expect(resPending2.body.length).toBe(1) // Still 1

    // Dismiss the reminder
    const reminderId = resPending.body[0].id
    await request(app)
      .post(`/api/v1/reminders/${reminderId}/dismiss`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(200)

    // Check pending list is now empty
    const resPending3 = await request(app)
      .get('/api/v1/reminders/pending')
      .set('Cookie', user.cookies)
      .expect(200)
    expect(resPending3.body.length).toBe(0)
  })
})
