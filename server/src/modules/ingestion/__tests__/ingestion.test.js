import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import { prisma } from '../../../lib/db.js'
import { ingestionQueue } from '../../../jobs/ingestion/ingestion.queue.js'
import { ingestionProcessor } from '../../../jobs/ingestion/processor.js'
import { parseJd } from '../../../jobs/ingestion/jdParser.js'
import { fetchAndExtract } from '../../../jobs/ingestion/fetcher.js'

// Mock fetching and LLM parsing
vi.mock('../../../jobs/ingestion/fetcher.js', () => ({
  fetchAndExtract: vi.fn().mockResolvedValue({
    rawText: 'Mock fetched text contents',
    title: 'Mock Page Title',
  }),
}))

vi.mock('../../../jobs/ingestion/jdParser.js', () => ({
  parseJd: vi.fn().mockResolvedValue({
    title: 'Software Engineer',
    company: 'Stripe',
    location: 'Remote',
    employmentType: 'Full-time',
    yoeMin: 3,
    yoeMax: 5,
    skills: ['JavaScript', 'Node.js'],
    niceToHave: ['Docker'],
    responsibilities: ['Build features'],
    salaryText: '$120k',
    applyDeadline: null,
  }),
}))

beforeAll(async () => {
  await prisma.$connect()
})

beforeEach(async () => {
  await prisma.stageEvent.deleteMany()
  await prisma.application.deleteMany()
  await prisma.jobDescription.deleteMany()
  await prisma.user.deleteMany()
  await ingestionQueue.drain()
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

describe('JD Ingestion Integration Tests', () => {
  it('enqueues job and transitions parse status successfully', async () => {
    const user = await getAuthData('user@example.com')

    const postRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({
        company: 'Stripe',
        roleTitle: 'Software Engineer',
        rawJd: 'Looking for a Senior backend engineer with node experience.',
      })

    expect(postRes.status).toBe(201)
    expect(postRes.body.jd).not.toBeNull()

    const jdId = postRes.body.jd.id

    // Check status is QUEUED
    const statusRes1 = await request(app)
      .get(`/api/v1/jd/${jdId}/status`)
      .set('Cookie', user.cookies)

    expect(statusRes1.status).toBe(200)
    expect(statusRes1.body.parseStatus).toBe('QUEUED')

    // Run processor manually
    await ingestionProcessor({ data: { jdId } })

    // Check status is DONE and structured is populated
    const statusRes2 = await request(app)
      .get(`/api/v1/jd/${jdId}/status`)
      .set('Cookie', user.cookies)

    expect(statusRes2.status).toBe(200)
    expect(statusRes2.body.parseStatus).toBe('DONE')
    expect(statusRes2.body.structured.company).toBe('Stripe')
    expect(statusRes2.body.structured.skills).toContain('JavaScript')
  })

  it('deduplicates identical raw JDs (idempotency)', async () => {
    const user = await getAuthData('user@example.com')
    const rawJd = 'Identical job description text.'

    const app1 = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({
        company: 'Stripe',
        roleTitle: 'Engineer',
        rawJd,
      })

    const app2 = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({
        company: 'Stripe',
        roleTitle: 'Frontend Engineer',
        rawJd,
      })

    expect(app1.body.jd.id).toBe(app2.body.jd.id)

    const jdCount = await prisma.jobDescription.count({
      where: { userId: user.userId },
    })
    expect(jdCount).toBe(1)
  })

  it('marks job status as FAILED if LLM throws', async () => {
    const user = await getAuthData('user@example.com')

    vi.mocked(parseJd).mockRejectedValueOnce(new Error('LLM rate limit reached'))

    const postRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({
        company: 'Stripe',
        roleTitle: 'Software Engineer',
        rawJd: 'This will fail.',
      })

    const jdId = postRes.body.jd.id

    // Run processor manually and expect it to throw
    await expect(ingestionProcessor({ data: { jdId } })).rejects.toThrow('LLM rate limit reached')

    // Verify status is FAILED with error message
    const statusRes = await request(app)
      .get(`/api/v1/jd/${jdId}/status`)
      .set('Cookie', user.cookies)

    expect(statusRes.status).toBe(200)
    expect(statusRes.body.parseStatus).toBe('FAILED')
    expect(statusRes.body.parseError).toBe('LLM rate limit reached')
  })

  it('blocks private IP URLs with 400 bad request before enqueueing', async () => {
    const user = await getAuthData('user@example.com')

    const postRes = await request(app)
      .post('/api/v1/applications')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({
        company: 'LocalHostCorp',
        roleTitle: 'Engineer',
        url: 'http://127.0.0.1/jobs/1',
      })

    expect(postRes.status).toBe(400)
    expect(postRes.body.error.code).toBe('SSRF_ERROR')

    const jdCount = await prisma.jobDescription.count({
      where: { userId: user.userId },
    })
    expect(jdCount).toBe(0)
  })
})
