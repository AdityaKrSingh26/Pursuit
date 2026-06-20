import { prisma } from '../../lib/db.js'
import { cached, CacheKey } from '../../lib/cache.js'

function cosineSim(a, b) {
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export async function getSkillDemand(userId) {
  return cached(CacheKey.skillDemand(userId), 3600, async () => _getSkillDemand(userId))
}

async function _getSkillDemand(userId) {
  // JDs are global — scope to this user via their Applications
  const jds = await prisma.jobDescription.findMany({
    where: {
      parseStatus: 'DONE',
      structured: { not: null },
      applications: { some: { userId, deletedAt: null } },
    },
    select: { structured: true },
  })

  const freq = {}
  for (const jd of jds) {
    const structured = jd.structured
    const skills = structured?.skills || []
    for (const skill of skills) {
      if (typeof skill === 'string') {
        const key = skill.toLowerCase().trim()
        if (key) {
          freq[key] = (freq[key] ?? 0) + 1
        }
      }
    }
  }

  const totalJds = jds.length
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([skill, count]) => ({
      skill: skill.charAt(0).toUpperCase() + skill.slice(1), // format nicely
      count,
      pct: totalJds > 0 ? Math.round((count / totalJds) * 100) : 0,
    }))
}

export async function getGapFrequency(userId) {
  const applications = await prisma.application.findMany({
    where: { userId, deletedAt: null },
    select: { id: true },
  })
  const appIds = applications.map((a) => a.id)

  const gapAnalyses = await prisma.analysis.findMany({
    where: {
      applicationId: { in: appIds },
      kind: 'GAP',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Deduplicate to get the latest per application
  const latestGaps = []
  const seen = new Set()
  for (const row of gapAnalyses) {
    if (!seen.has(row.applicationId)) {
      seen.add(row.applicationId)
      latestGaps.push(row)
    }
  }

  const missingFreq = {}
  for (const gap of latestGaps) {
    const result = gap.result
    const missing = result?.missingSkills || []
    for (const skill of missing) {
      if (typeof skill === 'string') {
        const key = skill.toLowerCase().trim()
        if (key) {
          missingFreq[key] = (missingFreq[key] ?? 0) + 1
        }
      }
    }
  }

  // Join with skill demand to get demandPct
  const demandList = await getSkillDemand(userId)
  const demandMap = {}
  for (const item of demandList) {
    demandMap[item.skill.toLowerCase()] = item.pct
  }

  return Object.entries(missingFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([skill, missingCount]) => ({
      skill: skill.charAt(0).toUpperCase() + skill.slice(1),
      missingCount,
      demandPct: demandMap[skill] || 0,
    }))
}

export async function getSimilarJobs(userId, jdId, k = 5) {
  const target = await prisma.$queryRaw`
    SELECT embedding::text FROM "JobDescription" WHERE id = ${jdId}
  `
  if (!target[0]?.embedding) return []

  const targetVectorStr = target[0].embedding

  // JDs are global; scope to user via Application join. HNSW index handles ANN search.
  const rows = await prisma.$queryRaw`
    SELECT app.id, app.company, app."roleTitle",
           1 - (jd.embedding <=> ${targetVectorStr}::vector) AS similarity
    FROM "JobDescription" jd
    JOIN "Application" app ON app."jdId" = jd.id
    WHERE app."userId" = ${userId}
      AND app."deletedAt" IS NULL
      AND jd.id != ${jdId}
      AND jd.embedding IS NOT NULL
    ORDER BY jd.embedding <=> ${targetVectorStr}::vector
    LIMIT ${k}
  `

  return rows.map((r) => ({
    id: r.id,
    company: r.company,
    roleTitle: r.roleTitle,
    similarity: Math.max(0, Math.min(1, Number(r.similarity))),
  }))
}

export async function getClusters(userId) {
  return cached(CacheKey.clusters(userId), 300, () => _getClusters(userId))
}

async function _getClusters(userId) {
  // JDs are global; scope to user via Application join
  const rows = await prisma.$queryRaw`
    SELECT jd.id, jd.embedding::text, jd.structured, app.id AS "appId", app.company, app."roleTitle"
    FROM "JobDescription" jd
    JOIN "Application" app ON app."jdId" = jd.id
    WHERE app."userId" = ${userId}
      AND app."deletedAt" IS NULL
      AND jd.embedding IS NOT NULL
  `

  const itemsMap = {}
  for (const row of rows) {
    if (!itemsMap[row.id]) {
      const rawStr = row.embedding
      const vector = rawStr.slice(1, -1).split(',').map(Number)
      const skills = row.structured?.skills || []
      itemsMap[row.id] = { id: row.id, vector, skills, applications: [] }
    }
    if (row.appId) {
      itemsMap[row.id].applications.push({
        id: row.appId,
        company: row.company,
        roleTitle: row.roleTitle,
      })
    }
  }

  const items = Object.values(itemsMap)
  const assigned = new Set()
  const clusters = []

  while (true) {
    let bestItem = null
    let bestNeighbors = []

    for (const item of items) {
      if (assigned.has(item.id)) continue
      const neighbors = []
      for (const other of items) {
        if (assigned.has(other.id)) continue
        if (cosineSim(item.vector, other.vector) >= 0.7) neighbors.push(other)
      }
      if (neighbors.length > bestNeighbors.length) {
        bestNeighbors = neighbors
        bestItem = item
      }
    }

    if (!bestItem) break

    for (const n of bestNeighbors) assigned.add(n.id)

    const skillFreq = {}
    for (const n of bestNeighbors) {
      for (const skill of n.skills) {
        if (typeof skill === 'string') {
          const key = skill.trim()
          if (key) skillFreq[key] = (skillFreq[key] ?? 0) + 1
        }
      }
    }

    const topSkills = Object.entries(skillFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s)

    clusters.push({
      label: topSkills.join(', ') || 'General Jobs',
      skills: topSkills,
      jobIds: bestNeighbors.map((n) => n.id),
      size: bestNeighbors.length,
      applications: bestNeighbors.flatMap((n) => n.applications),
    })
  }

  return clusters
}
