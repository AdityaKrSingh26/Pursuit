import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import { prisma } from '../../../lib/db.js'
import { redis } from '../../../lib/redis.js'

const mockFinalMessage = vi.fn().mockResolvedValue({
  content: [{
    type: 'text',
    text: JSON.stringify({
      technicalQuestions: [{ text: 'Explain React hooks.', reason: 'React skill listed.' }],
      behavioralQuestions: [{ text: 'Tell me about a time you resolved a conflict.', reason: 'Standard behavior check.' }],
      gapProbes: [{ text: 'Have you worked with Kubernetes?', reason: 'JD requires Kubernetes, not on resume.' }],
      companyAngle: 'Stripe focuses on technical depth and API design.'
    })
  }],
  usage: { input_tokens: 100, output_tokens: 200 }
})

const mockStream = {
  on: vi.fn((event, callback) => {
    if (event === 'text') {
      callback('{"technicalQuestions')
      callback('": []}')
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

describe('Interview Prep Integration Tests', () => {
  it('streams interview prep questions via SSE successfully', async () => {
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
      .post(`/api/v1/applications/${application.id}/analysis/prep`)
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
    expect(events[events.length - 2].data.technicalQuestions[0].text).toBe('Explain React hooks.')
    expect(events[events.length - 1].type).toBe('done')

    expect(mockMessagesStream).toHaveBeenCalledTimes(1)

    const analysisCount = await prisma.analysis.count({
      where: { applicationId: application.id, kind: 'PREP' }
    })
    expect(analysisCount).toBe(1)
  })

  it('serves cached prep questions on duplicate requests', async () => {
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
      .post(`/api/v1/applications/${application.id}/analysis/prep`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(200)

    // Request 2
    const res = await request(app)
      .post(`/api/v1/applications/${application.id}/analysis/prep`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(200)

    const lines = res.text.split('\n\n')
    const events = lines
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.substring(6)))

    expect(events.length).toBe(2)
    expect(events[0].type).toBe('result')
    expect(events[1].type).toBe('done')

    expect(mockMessagesStream).toHaveBeenCalledTimes(1)
  })

  it('enforces prep rate limit of 3 requests per application daily', async () => {
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

    // 1st request -> Allowed
    await request(app)
      .post(`/api/v1/applications/${application.id}/analysis/prep`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(200)

    // 2nd request -> Allowed
    await request(app)
      .post(`/api/v1/applications/${application.id}/analysis/prep`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(200)

    // 3rd request -> Allowed
    await request(app)
      .post(`/api/v1/applications/${application.id}/analysis/prep`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(200)

    // 4th request -> Blocked with 429
    const res = await request(app)
      .post(`/api/v1/applications/${application.id}/analysis/prep`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(429)

    expect(res.body.error.code).toBe('RATE_LIMIT')
    expect(res.body.remaining).toBe(0)
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
      .post(`/api/v1/applications/${application.id}/analysis/prep`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(400)

    expect(res.body.error.message).toContain('not parsed')
  })
})
