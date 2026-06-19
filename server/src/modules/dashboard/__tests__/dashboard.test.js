import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import { prisma } from '../../../lib/db.js'

beforeAll(async () => {
  await prisma.$connect()
})

beforeEach(async () => {
  await prisma.analysis.deleteMany()
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

describe('Dashboard Integration Tests', () => {
  it('returns valid metrics for /dashboard/funnel and /dashboard/velocity', async () => {
    const user = await getAuthData('user@example.com')

    // Create 3 applications: 1 SAVED, 1 APPLIED, 1 OA
    const appSaved = await prisma.application.create({
      data: { userId: user.userId, company: 'Company A', roleTitle: 'Engineer', stage: 'SAVED' },
    })

    const appApplied = await prisma.application.create({
      data: { userId: user.userId, company: 'Company B', roleTitle: 'Designer', stage: 'APPLIED' },
    })

    const appOa = await prisma.application.create({
      data: { userId: user.userId, company: 'Company C', roleTitle: 'PM', stage: 'OA' },
    })

    // Create some stage events to test duration calculation:
    // Event 1: appOa moved from SAVED to APPLIED (2 days ago)
    // Event 2: appOa moved from APPLIED to OA (1 day ago)
    const now = new Date()
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)

    await prisma.stageEvent.createMany({
      data: [
        { applicationId: appOa.id, fromStage: 'SAVED', toStage: 'APPLIED', at: twoDaysAgo },
        { applicationId: appOa.id, fromStage: 'APPLIED', toStage: 'OA', at: oneDayAgo },
      ],
    })

    // Create an analysis record to assert LLM costs are aggregated
    await prisma.analysis.create({
      data: {
        applicationId: appOa.id,
        kind: 'GAP',
        jdHash: 'hash-dash-1',
        result: {},
        tokensIn: 100,
        tokensOut: 200,
        costUsd: 0.0045,
      },
    })

    // Test /dashboard/funnel
    const funnelRes = await request(app)
      .get('/api/v1/dashboard/funnel')
      .set('Cookie', user.cookies)
      .expect(200)

    expect(funnelRes.body.stageCounts).toBeDefined()
    expect(funnelRes.body.stageCounts.SAVED).toBe(1)
    expect(funnelRes.body.stageCounts.APPLIED).toBe(1)
    expect(funnelRes.body.stageCounts.OA).toBe(1)
    expect(funnelRes.body.conversionRates).toBeDefined()
    expect(funnelRes.body.ghostRate).toBe(0)
    expect(funnelRes.body.responseRate).toBe(50) // OA is responded; denominator = APPLIED (1) + OA (1) = 2. 1/2 = 50%
    expect(funnelRes.body.medianDaysInStage).toBeDefined()

    // Test /dashboard/velocity
    const velocityRes = await request(app)
      .get('/api/v1/dashboard/velocity')
      .set('Cookie', user.cookies)
      .expect(200)

    expect(velocityRes.body.velocity).toBeDefined()
    expect(velocityRes.body.velocity).toHaveLength(8)
    // The current week should have count = 3 (since we created 3 applications today)
    const currentWeekVelocity = velocityRes.body.velocity[7]
    expect(currentWeekVelocity.count).toBe(3)

    expect(velocityRes.body.llmCost).toBeDefined()
    expect(velocityRes.body.llmCost.byWeek).toHaveLength(8)
    const currentWeekCost = velocityRes.body.llmCost.byWeek[7]
    expect(currentWeekCost.costUsd).toBe(0.0045)
    expect(velocityRes.body.llmCost.totalThisMonth).toBe(0.0045)
  })
})
