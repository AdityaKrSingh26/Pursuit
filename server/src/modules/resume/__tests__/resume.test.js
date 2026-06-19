import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import { prisma } from '../../../lib/db.js'

beforeAll(async () => { await prisma.$connect() })

beforeEach(async () => {
  await prisma.resumeVersion.deleteMany()
  await prisma.resumeBlock.deleteMany()
  await prisma.application.deleteMany()
  await prisma.jobDescription.deleteMany()
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

describe('Resume Blocks CRUD', () => {
  it('creates a block and returns it on GET', async () => {
    const user = await getAuthData('user@example.com')

    const postRes = await request(app)
      .post('/api/v1/resume/blocks')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ section: 'EXPERIENCE', content: 'Built APIs at Stripe', skillTags: ['Node.js'], orderDefault: 1 })
      .expect(201)

    expect(postRes.body.content).toBe('Built APIs at Stripe')
    expect(postRes.body.section).toBe('EXPERIENCE')

    const getRes = await request(app)
      .get('/api/v1/resume/blocks')
      .set('Cookie', user.cookies)
      .expect(200)

    expect(getRes.body).toHaveLength(1)
    expect(getRes.body[0].id).toBe(postRes.body.id)
  })

  it('updates a block', async () => {
    const user = await getAuthData('user@example.com')

    const created = await request(app)
      .post('/api/v1/resume/blocks')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ section: 'SKILLS', content: 'JavaScript', skillTags: [], orderDefault: 0 })
      .expect(201)

    const updated = await request(app)
      .patch(`/api/v1/resume/blocks/${created.body.id}`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ content: 'TypeScript, JavaScript', skillTags: ['TypeScript'] })
      .expect(200)

    expect(updated.body.content).toBe('TypeScript, JavaScript')
    expect(updated.body.skillTags).toContain('TypeScript')
  })

  it('archives a block (soft delete)', async () => {
    const user = await getAuthData('user@example.com')

    const created = await request(app)
      .post('/api/v1/resume/blocks')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ section: 'EDUCATION', content: 'B.Tech CSE', skillTags: [], orderDefault: 0 })
      .expect(201)

    await request(app)
      .delete(`/api/v1/resume/blocks/${created.body.id}`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .expect(204)

    const getRes = await request(app)
      .get('/api/v1/resume/blocks')
      .set('Cookie', user.cookies)
      .expect(200)

    expect(getRes.body).toHaveLength(0)
  })

  it('reorders blocks and enforces ownership', async () => {
    const user = await getAuthData('user@example.com')
    const other = await getAuthData('other@example.com')

    const b1 = await request(app)
      .post('/api/v1/resume/blocks')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ section: 'SKILLS', content: 'A', skillTags: [], orderDefault: 0 })
      .expect(201)

    const b2 = await request(app)
      .post('/api/v1/resume/blocks')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ section: 'SKILLS', content: 'B', skillTags: [], orderDefault: 1 })
      .expect(201)

    // Reorder as owner
    await request(app)
      .post('/api/v1/resume/blocks/reorder')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ updates: [{ id: b1.body.id, orderDefault: 1 }, { id: b2.body.id, orderDefault: 0 }] })
      .expect(204)

    // Attempt reorder as another user — should be 403
    const forbidRes = await request(app)
      .post('/api/v1/resume/blocks/reorder')
      .set('Cookie', other.cookies)
      .set('x-csrf-token', other.csrfToken)
      .send({ updates: [{ id: b1.body.id, orderDefault: 0 }] })
      .expect(403)

    expect(forbidRes.body.error.code).toBe('FORBIDDEN')
  })

  it('creates a resume version snapshot from approved blocks', async () => {
    const user = await getAuthData('user@example.com')

    const jd = await prisma.jobDescription.create({
      data: {
        userId: user.userId,
        sourceUrl: 'https://stripe.com/jobs/1',
        rawText: 'Backend role',
        jdHash: 'hash-rv-1',
        parseStatus: 'DONE',
        structured: { title: 'Engineer', company: 'Stripe', skills: ['Node.js'] },
      },
    })

    const application = await prisma.application.create({
      data: { userId: user.userId, jdId: jd.id, company: 'Stripe', roleTitle: 'Engineer' },
    })

    const block = await request(app)
      .post('/api/v1/resume/blocks')
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ section: 'EXPERIENCE', content: 'Led platform team', skillTags: [], orderDefault: 0 })
      .expect(201)

    const versionRes = await request(app)
      .post(`/api/v1/applications/${application.id}/resume-version`)
      .set('Cookie', user.cookies)
      .set('x-csrf-token', user.csrfToken)
      .send({ approvedBlocks: [{ blockId: block.body.id, content: 'Led platform team' }] })
      .expect(201)

    expect(versionRes.body.resumeVersionId).toBeDefined()

    // Verify snapshot is immutable in DB
    const version = await prisma.resumeVersion.findUnique({
      where: { id: versionRes.body.resumeVersionId },
    })
    expect(version).not.toBeNull()
    expect(Array.isArray(version.blocksSnapshot)).toBe(true)
    expect(version.blocksSnapshot[0].content).toBe('Led platform team')
  })

  it('returns 202 rendering status while PDF is not yet ready', async () => {
    const user = await getAuthData('user@example.com')

    const version = await prisma.resumeVersion.create({
      data: {
        userId: user.userId,
        blocksSnapshot: [{ blockId: 'b1', content: 'Some content' }],
      },
    })

    const res = await request(app)
      .get(`/api/v1/resume-versions/${version.id}/pdf`)
      .set('Cookie', user.cookies)
      .expect(202)

    expect(res.body.status).toBe('rendering')
  })
})
