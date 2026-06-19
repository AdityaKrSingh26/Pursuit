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

// Generate simple mock unit vector of dimension 1536
function makeUnitVector(nonZeroIndex) {
  const vec = Array.from({ length: 1536 }, () => 0)
  vec[nonZeroIndex] = 1.0
  return vec
}

describe('Intelligence Integration Tests', () => {
  it('aggregates skill demand, gaps, similar jobs, and clusters correctly', async () => {
    const user = await getAuthData('coder@example.com')

    // Create 3 JDs
    const jd1 = await prisma.jobDescription.create({
      data: {
        userId: user.userId,
        rawText: 'React React React Node',
        jdHash: 'hash-react-1',
        parseStatus: 'DONE',
        structured: {
          skills: ['React', 'Node.js', 'JavaScript'],
          niceToHave: [],
          responsibilities: [],
        },
      },
    })

    const jd2 = await prisma.jobDescription.create({
      data: {
        userId: user.userId,
        rawText: 'React Typescript Node',
        jdHash: 'hash-react-2',
        parseStatus: 'DONE',
        structured: {
          skills: ['React', 'Node.js', 'TypeScript'],
          niceToHave: [],
          responsibilities: [],
        },
      },
    })

    const jd3 = await prisma.jobDescription.create({
      data: {
        userId: user.userId,
        rawText: 'Python Django Postgres',
        jdHash: 'hash-python-3',
        parseStatus: 'DONE',
        structured: {
          skills: ['Python', 'Django', 'PostgreSQL'],
          niceToHave: [],
          responsibilities: [],
        },
      },
    })

    // Update embeddings via raw SQL to bypass Prisma Unsupported type mapping
    const vec1 = makeUnitVector(0) // [1, 0, 0, ...]
    const vec2 = makeUnitVector(0) // same dimension -> sim = 1.0
    // Slightly alter vec2 to test clustering similarity (> 0.7) vs cosine distance
    vec2[0] = 0.95
    vec2[1] = 0.31 // sqrt(0.95^2 + 0.31^2) ~ 1.0
    const vec3 = makeUnitVector(10) // [0, ..., 1, ...] -> orthogonal -> sim = 0

    await prisma.$executeRawUnsafe(
      `UPDATE "JobDescription" SET embedding = '[${vec1.join(',')}]'::vector WHERE id = '${jd1.id}'`
    )
    await prisma.$executeRawUnsafe(
      `UPDATE "JobDescription" SET embedding = '[${vec2.join(',')}]'::vector WHERE id = '${jd2.id}'`
    )
    await prisma.$executeRawUnsafe(
      `UPDATE "JobDescription" SET embedding = '[${vec3.join(',')}]'::vector WHERE id = '${jd3.id}'`
    )

    // Link JDs to applications
    const app1 = await prisma.application.create({
      data: {
        userId: user.userId,
        company: 'Company Alpha',
        roleTitle: 'React Developer',
        jdId: jd1.id,
        stage: 'SAVED',
      },
    })

    const app2 = await prisma.application.create({
      data: {
        userId: user.userId,
        company: 'Company Beta',
        roleTitle: 'Frontend Engineer',
        jdId: jd2.id,
        stage: 'APPLIED',
      },
    })

    const app3 = await prisma.application.create({
      data: {
        userId: user.userId,
        company: 'Company Gamma',
        roleTitle: 'Python Dev',
        jdId: jd3.id,
        stage: 'SAVED',
      },
    })

    // Create GAP analyses to assert gap metrics
    await prisma.analysis.createMany({
      data: [
        {
          applicationId: app1.id,
          kind: 'GAP',
          jdHash: jd1.jdHash,
          result: {
            missingSkills: ['TypeScript', 'JavaScript'],
          },
          tokensIn: 50,
          tokensOut: 100,
          costUsd: 0.001,
        },
        {
          applicationId: app2.id,
          kind: 'GAP',
          jdHash: jd2.jdHash,
          result: {
            missingSkills: ['TypeScript'],
          },
          tokensIn: 50,
          tokensOut: 100,
          costUsd: 0.001,
        },
      ],
    })

    // Test GET /api/v1/intel/skill-demand
    const skillDemandRes = await request(app)
      .get('/api/v1/intel/skill-demand')
      .set('Cookie', user.cookies)
      .expect(200)

    expect(skillDemandRes.body).toBeDefined()
    expect(skillDemandRes.body.length).toBeGreaterThan(0)
    // React is present in 2 out of 3 JDs
    const reactItem = skillDemandRes.body.find((item) => item.skill.toLowerCase() === 'react')
    expect(reactItem).toBeDefined()
    expect(reactItem.count).toBe(2)
    expect(reactItem.pct).toBe(67)

    // Test GET /api/v1/intel/gap-frequency
    const gapFreqRes = await request(app)
      .get('/api/v1/intel/gap-frequency')
      .set('Cookie', user.cookies)
      .expect(200)

    expect(gapFreqRes.body).toBeDefined()
    expect(gapFreqRes.body.length).toBeGreaterThan(0)
    // TypeScript is missing in 2 applications
    const tsGap = gapFreqRes.body.find((item) => item.skill.toLowerCase() === 'typescript')
    expect(tsGap).toBeDefined()
    expect(tsGap.missingCount).toBe(2)

    // Test GET /api/v1/applications/:id/similar
    const similarRes = await request(app)
      .get(`/api/v1/applications/${app1.id}/similar`)
      .set('Cookie', user.cookies)
      .expect(200)

    expect(similarRes.body).toBeDefined()
    expect(similarRes.body.length).toBe(2) // jd2 and jd3 should be listed
    const topMatch = similarRes.body[0]
    expect(topMatch.id).toBe(app2.id)
    expect(topMatch.similarity).toBeGreaterThan(0.9) // very high similarity

    // Test GET /api/v1/intel/clusters
    const clustersRes = await request(app)
      .get('/api/v1/intel/clusters')
      .set('Cookie', user.cookies)
      .expect(200)

    expect(clustersRes.body).toBeDefined()
    // Should have 2 clusters:
    // Cluster 1: React jobs (jd1, jd2)
    // Cluster 2: Python job (jd3)
    expect(clustersRes.body.length).toBe(2)

    const reactCluster = clustersRes.body.find((c) => c.skills.includes('React'))
    expect(reactCluster).toBeDefined()
    expect(reactCluster.size).toBe(2)

    const pythonCluster = clustersRes.body.find((c) => c.skills.includes('Python'))
    expect(pythonCluster).toBeDefined()
    expect(pythonCluster.size).toBe(1)
  })
})
