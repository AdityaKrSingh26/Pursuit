import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import { prisma } from '../../../lib/db.js'
import { redis } from '../../../lib/redis.js'

const mockFinalMessage = vi.fn().mockResolvedValue({
  content: [{
    type: 'text',
    text: JSON.stringify({
      matchedSkills: ['JavaScript', 'Node.js'],
      missingSkills: ['Kubernetes'],
      partialSkills: ['React'],
      bulletRanking: [
        { blockId: 'block-1', relevanceScore: 80, reason: 'Strong backend experience' }
      ],
      riskQuestions: ['Do they know Go?'],
      overallSummary: 'Good match overall.',
      llmRelevanceScore: 85
    })
  }],
  usage: { input_tokens: 100, output_tokens: 200 }
})

const mockStream = {
  on: vi.fn((event, callback) => {
    if (event === 'text') {
      callback('{"matchedSkills')
      callback('": ["JS"]}')
    }
  }),
  finalMessage: mockFinalMessage
}

const mockMessagesStream = vi.fn().mockReturnValue(mockStream)

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        messages: {
          stream: mockMessagesStream
        }
      }
    })
  }
})

beforeAll(async () => {
  await prisma.$connect()
})

beforeEach(async () => {
  await prisma.analysis.deleteMany()
  await prisma.application.deleteMany()
  await prisma.jobDescription.deleteMany()
  await prisma.resumeBlock.deleteMany()
  await prisma.user.deleteMany()
  await redis.flushall()
  mockMessagesStream.mockClear()
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

describe('Gap Analysis Integration Tests', () => {
  it('streams gap analysis results via SSE successfully', async () => {
    const user = await getAuthData('user@example.com')

    const jd = await prisma.jobDescription.create({
      data: {
        userId: user.userId,
        sourceUrl: 'https://stripe.com/jobs/1',
        rawText: 'Frontend role',
        jdHash: 'hash-1234',
        parseStatus: 'DONE',
        structured: {
          title: 'Frontend Engineer',
          company: 'Stripe',
          skills: ['JavaScript', 'React'],
        }
      }
    })

    const application = await prisma.application.create({
      data: {
        userId: user.userId,
        jdId: jd.id,
        company: 'Stripe',
        roleTitle: 'Frontend Engineer',
      }
    })

    const _block = await prisma.resumeBlock.create({
      data: {
        id: 'block-1',
        userId: user.userId,
        section: 'EXPERIENCE',
        content: 'Built React apps',
        skillTags: ['React'],
        orderDefault: 1,
      }
    })

    const res = await request(app)
      .post(`/api/v1/applications/${application.id}/analysis/gap`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(200)
      .expect('Content-Type', /event-stream/)

    const lines = res.text.split('\n\n')
    const events = lines
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.substring(6)))

    expect(events.length).toBeGreaterThanOrEqual(4)
    expect(events[0].type).toBe('token')
    expect(events[events.length - 2].type).toBe('result')
    expect(events[events.length - 2].data.matchScore).toBeDefined()
    expect(events[events.length - 1].type).toBe('done')

    expect(mockMessagesStream).toHaveBeenCalledTimes(1)
  })

  it('serves cached gap analysis on duplicate requests', async () => {
    const user = await getAuthData('user@example.com')

    const jd = await prisma.jobDescription.create({
      data: {
        userId: user.userId,
        sourceUrl: 'https://stripe.com/jobs/1',
        rawText: 'Frontend role',
        jdHash: 'hash-1234',
        parseStatus: 'DONE',
        structured: {
          title: 'Frontend Engineer',
          company: 'Stripe',
          skills: ['JavaScript', 'React'],
        }
      }
    })

    const application = await prisma.application.create({
      data: {
        userId: user.userId,
        jdId: jd.id,
        company: 'Stripe',
        roleTitle: 'Frontend Engineer',
      }
    })

    // Request 1
    await request(app)
      .post(`/api/v1/applications/${application.id}/analysis/gap`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(200)

    // Request 2
    const res = await request(app)
      .post(`/api/v1/applications/${application.id}/analysis/gap`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(200)

    const lines = res.text.split('\n\n')
    const events = lines
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.substring(6)))

    // Cached response doesn't stream token events
    expect(events.length).toBe(2)
    expect(events[0].type).toBe('result')
    expect(events[1].type).toBe('done')

    // LLM mock called exactly once
    expect(mockMessagesStream).toHaveBeenCalledTimes(1)

    const analysisCount = await prisma.analysis.count({
      where: { applicationId: application.id }
    })
    expect(analysisCount).toBe(1)
  })

  it('enforces rate limits of 30 requests/day', async () => {
    const user = await getAuthData('user@example.com')

    const jd = await prisma.jobDescription.create({
      data: {
        userId: user.userId,
        sourceUrl: 'https://stripe.com/jobs/1',
        rawText: 'Frontend role',
        jdHash: 'hash-1234',
        parseStatus: 'DONE',
        structured: {
          title: 'Frontend Engineer',
          company: 'Stripe',
          skills: ['JavaScript', 'React'],
        }
      }
    })

    const application = await prisma.application.create({
      data: {
        userId: user.userId,
        jdId: jd.id,
        company: 'Stripe',
        roleTitle: 'Frontend Engineer',
      }
    })

    // Seed Redis rate limit key to 30
    const today = new Date().toISOString().split('T')[0]
    const limitKey = `ratelimit:llm:${user.userId}:${today}`
    await redis.set(limitKey, 30)

    const res = await request(app)
      .post(`/api/v1/applications/${application.id}/analysis/gap`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(429)

    expect(res.body.error.code).toBe('RATE_LIMIT')
  })

  it('returns 400 error if job description is not parsed', async () => {
    const user = await getAuthData('user@example.com')

    const jd = await prisma.jobDescription.create({
      data: {
        userId: user.userId,
        sourceUrl: 'https://stripe.com/jobs/1',
        rawText: 'Frontend role',
        jdHash: 'hash-1234',
        parseStatus: 'QUEUED',
      }
    })

    const application = await prisma.application.create({
      data: {
        userId: user.userId,
        jdId: jd.id,
        company: 'Stripe',
        roleTitle: 'Frontend Engineer',
      }
    })

    const res = await request(app)
      .post(`/api/v1/applications/${application.id}/analysis/gap`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(400)

    expect(res.body.error.message).toContain('not parsed')
  })
})
