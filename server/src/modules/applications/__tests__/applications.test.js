import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import { prisma } from '../../../lib/db.js'

beforeAll(async () => {
  await prisma.$connect()
})

beforeEach(async () => {
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
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password })

  const accessToken = extractCookie(res, 'accessToken')
  const csrfToken = extractCookie(res, 'csrfToken')

  return {
    userId: res.body.id,
    accessToken,
    csrfToken,
    cookies: `accessToken=${accessToken}; csrfToken=${csrfToken}`,
  }
}

describe('Applications Integration Tests', () => {
  // ── Create & Get ─────────────────────────────────────────────────────────────
  it('creates an application and returns it on GET', async () => {
    const user = await getAuthData('user@example.com')

    // Create
    const createRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({
        company: 'Stripe',
        roleTitle: 'Software Engineer',
        source: 'Referral',
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.company).toBe('Stripe')
    expect(createRes.body.roleTitle).toBe('Software Engineer')
    expect(createRes.body.source).toBe('Referral')
    expect(createRes.body.stage).toBe('SAVED')
    expect(createRes.body.stageEvents).toHaveLength(1)
    expect(createRes.body.stageEvents[0].toStage).toBe('SAVED')

    const appId = createRes.body.id

    // Get
    const getRes = await request(app)
      .get(`/api/v1/applications/${appId}`)
      .set('Cookie', user.cookies)

    expect(getRes.status).toBe(200)
    expect(getRes.body.id).toBe(appId)
    expect(getRes.body.company).toBe('Stripe')
    expect(getRes.body.roleTitle).toBe('Software Engineer')
  })

  // ── Stage History & Transitions ──────────────────────────────────────────────
  it('tracks stage history correctly through transitions', async () => {
    const user = await getAuthData('user@example.com')

    const createRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({
        company: 'Google',
        roleTitle: 'Developer',
      })

    const appId = createRes.body.id

    // Transition 1: SAVED -> APPLIED
    const patchRes1 = await request(app)
      .patch(`/api/v1/applications/${appId}`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ stage: 'APPLIED' })

    expect(patchRes1.status).toBe(200)
    expect(patchRes1.body.stage).toBe('APPLIED')

    // Transition 2: APPLIED -> TECH
    const patchRes2 = await request(app)
      .patch(`/api/v1/applications/${appId}`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ stage: 'TECH' })

    expect(patchRes2.status).toBe(200)
    expect(patchRes2.body.stage).toBe('TECH')

    // Fetch history
    const historyRes = await request(app)
      .get(`/api/v1/applications/${appId}/stage-history`)
      .set('Cookie', user.cookies)

    expect(historyRes.status).toBe(200)
    expect(historyRes.body).toHaveLength(3)

    // Verify history events sequence
    expect(historyRes.body[0].fromStage).toBeNull()
    expect(historyRes.body[0].toStage).toBe('SAVED')

    expect(historyRes.body[1].fromStage).toBe('SAVED')
    expect(historyRes.body[1].toStage).toBe('APPLIED')

    expect(historyRes.body[2].fromStage).toBe('APPLIED')
    expect(historyRes.body[2].toStage).toBe('TECH')
  })

  // ── Full-Text Search (FTS) ───────────────────────────────────────────────────
  it('supports full-text search querying by keyword', async () => {
    const user = await getAuthData('user@example.com')

    // Create Stripe application
    const stripeRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({
        company: 'Stripe',
        roleTitle: 'Backend Engineer',
      })
    const stripeId = stripeRes.body.id
    await request(app)
      .patch(`/api/v1/applications/${stripeId}`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ notes: 'Needs dynamic resume tailoring' })

    // Create Netflix application
    const netflixRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({
        company: 'Netflix',
        roleTitle: 'UI Engineer',
      })
    const netflixId = netflixRes.body.id
    await request(app)
      .patch(`/api/v1/applications/${netflixId}`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ notes: 'React expert role' })

    // Search for Stripe
    const stripeSearch = await request(app)
      .get('/api/v1/applications?q=stripe')
      .set('Cookie', user.cookies)

    expect(stripeSearch.status).toBe(200)
    expect(stripeSearch.body.items).toHaveLength(1)
    expect(stripeSearch.body.items[0].company).toBe('Stripe')

    // Search for React
    const reactSearch = await request(app)
      .get('/api/v1/applications?q=react')
      .set('Cookie', user.cookies)

    expect(reactSearch.status).toBe(200)
    expect(reactSearch.body.items).toHaveLength(1)
    expect(reactSearch.body.items[0].company).toBe('Netflix')

    // Search for non-existent keyword
    const emptySearch = await request(app)
      .get('/api/v1/applications?q=google')
      .set('Cookie', user.cookies)

    expect(emptySearch.status).toBe(200)
    expect(emptySearch.body.items).toHaveLength(0)
  })

  // ── Cursor Pagination ────────────────────────────────────────────────────────
  it('performs cursor pagination correctly across pages', async () => {
    const user = await getAuthData('user@example.com')

    // Create 25 applications with controlled timestamps (newest to oldest)
    const baseTime = Date.now()
    for (let i = 0; i < 25; i++) {
      await prisma.application.create({
        data: {
          userId: user.userId,
          company: `Company ${i}`,
          roleTitle: `Role ${i}`,
          createdAt: new Date(baseTime - i * 1000),
          stageEvents: {
            create: {
              fromStage: null,
              toStage: 'SAVED',
              at: new Date(baseTime - i * 1000),
            },
          },
        },
      })
    }

    // Get first page (limit=20)
    const page1Res = await request(app)
      .get('/api/v1/applications?limit=20')
      .set('Cookie', user.cookies)

    expect(page1Res.status).toBe(200)
    expect(page1Res.body.items).toHaveLength(20)
    expect(page1Res.body.items[0].company).toBe('Company 0') // Newest first
    expect(page1Res.body.items[19].company).toBe('Company 19')
    expect(page1Res.body.nextCursor).not.toBeNull()

    const cursor = page1Res.body.nextCursor

    // Get second page using cursor
    const page2Res = await request(app)
      .get(`/api/v1/applications?limit=20&cursor=${cursor}`)
      .set('Cookie', user.cookies)

    expect(page2Res.status).toBe(200)
    expect(page2Res.body.items).toHaveLength(5)
    expect(page2Res.body.items[0].company).toBe('Company 20')
    expect(page2Res.body.items[4].company).toBe('Company 24')
    expect(page2Res.body.nextCursor).toBeNull()
  })

  // ── User Isolation ───────────────────────────────────────────────────────────
  it('enforces user isolation and returns 403 on cross-user access', async () => {
    const userA = await getAuthData('usera@example.com')
    const userB = await getAuthData('userb@example.com')

    // User A creates an application
    const createRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', userA.cookies)
      .set('x-csrf-token', userA.csrfToken)
      .send({
        company: 'Target Corp',
        roleTitle: 'Intern',
      })

    const appId = createRes.body.id

    // User B tries to GET User A's application
    const getRes = await request(app)
      .get(`/api/v1/applications/${appId}`)
      .set('Cookie', userB.cookies)

    expect(getRes.status).toBe(403)

    // User B tries to PATCH User A's application
    const patchRes = await request(app)
      .patch(`/api/v1/applications/${appId}`)
      .set('Cookie', userB.cookies)
      .set('x-csrf-token', userB.csrfToken)
      .send({ notes: 'Sneaking in' })

    expect(patchRes.status).toBe(403)

    // User B tries to DELETE User A's application
    const deleteRes = await request(app)
      .delete(`/api/v1/applications/${appId}`)
      .set('Cookie', userB.cookies)
      .set('x-csrf-token', userB.csrfToken)

    expect(deleteRes.status).toBe(403)
  })

  // ── Cascading Deletes ────────────────────────────────────────────────────────
  it('cascades deletion to dependent StageEvent rows', async () => {
    const user = await getAuthData('user@example.com')

    const createRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({
        company: 'Vanguard',
        roleTitle: 'Analyst',
      })

    const appId = createRes.body.id

    // Check that stage event exists
    const eventsBefore = await prisma.stageEvent.findMany({
      where: { applicationId: appId },
    })
    expect(eventsBefore).toHaveLength(1)

    // Delete application
    const deleteRes = await request(app)
      .delete(`/api/v1/applications/${appId}`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)

    expect(deleteRes.status).toBe(204)

    // Check DB
    const appCount = await prisma.application.count({
      where: { id: appId },
    })
    expect(appCount).toBe(0)

    const eventsAfter = await prisma.stageEvent.findMany({
      where: { applicationId: appId },
    })
    expect(eventsAfter).toHaveLength(0)
  })
})
