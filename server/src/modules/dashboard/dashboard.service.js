import { prisma } from '../../lib/db.js'

const FUNNEL_STAGES = ['SAVED', 'APPLIED', 'OA', 'TECH', 'HR', 'OFFER']
const ALL_STAGES = ['SAVED', 'APPLIED', 'OA', 'TECH', 'HR', 'OFFER', 'REJECTED', 'GHOSTED']

function getWeekStartUTC(date) {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0, 0))
  return monday
}

function get8WeeksStartDatesUTC() {
  const now = new Date()
  const currentWeekStart = getWeekStartUTC(now)
  const weeks = []
  for (let i = 7; i >= 0; i--) {
    const wStart = new Date(currentWeekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    weeks.push(wStart)
  }
  return weeks
}

export async function getFunnel(userId) {
  const stageCountsRaw = await prisma.application.groupBy({
    by: ['stage'],
    where: { userId },
    _count: { stage: true },
  })

  // Initialize all counts to 0
  const stageCounts = {}
  for (const s of ALL_STAGES) {
    stageCounts[s] = 0
  }
  for (const row of stageCountsRaw) {
    stageCounts[row.stage] = row._count.stage
  }

  // Conversion rates (each stage count / previous stage count)
  const conversionRates = {}
  for (const s of ALL_STAGES) {
    conversionRates[s] = null
  }

  for (let i = 1; i < FUNNEL_STAGES.length; i++) {
    const curr = FUNNEL_STAGES[i]
    const prev = FUNNEL_STAGES[i - 1]
    const prevCount = stageCounts[prev]
    if (prevCount > 0) {
      conversionRates[curr] = Math.round((stageCounts[curr] / prevCount) * 100)
    } else {
      conversionRates[curr] = 0
    }
  }

  // Denominator: reached at least APPLIED (exclude SAVED)
  const total = Object.values(stageCounts).reduce((a, b) => a + b, 0)
  const appliedPlus = total - (stageCounts.SAVED || 0)

  // Ghost rate: GHOSTED / denominator
  const ghostRate = appliedPlus > 0 ? Math.round(((stageCounts.GHOSTED || 0) / appliedPlus) * 100) : 0

  // Response rate: (OA + TECH + HR + OFFER) / denominator
  const responded = (stageCounts.OA || 0) + (stageCounts.TECH || 0) + (stageCounts.HR || 0) + (stageCounts.OFFER || 0)
  const responseRate = appliedPlus > 0 ? Math.round((responded / appliedPlus) * 100) : 0

  return {
    stageCounts,
    conversionRates,
    ghostRate,
    responseRate,
    total,
  }
}

export async function getMedianDaysInStage(userId) {
  // Fetch all StageEvent rows for this user
  const events = await prisma.stageEvent.findMany({
    where: {
      application: { userId },
    },
    orderBy: [
      { applicationId: 'asc' },
      { at: 'asc' },
    ],
  })

  // Group events by applicationId
  const appEvents = {}
  for (const ev of events) {
    if (!appEvents[ev.applicationId]) {
      appEvents[ev.applicationId] = []
    }
    appEvents[ev.applicationId].push(ev)
  }

  // Durations array per starting stage
  const durationsByStage = {}
  for (const s of ALL_STAGES) {
    durationsByStage[s] = []
  }

  for (const appId in appEvents) {
    const evs = appEvents[appId]
    for (let i = 0; i < evs.length - 1; i++) {
      const stage = evs[i].toStage
      const diffMs = evs[i + 1].at.getTime() - evs[i].at.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      if (durationsByStage[stage]) {
        durationsByStage[stage].push(diffDays)
      }
    }
  }

  // Compute medians
  const medianDaysInStage = {}
  for (const s of ALL_STAGES) {
    const list = durationsByStage[s]
    if (list.length === 0) {
      medianDaysInStage[s] = 0
    } else {
      const sorted = [...list].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const medianVal = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
      medianDaysInStage[s] = Math.round(medianVal)
    }
  }

  return medianDaysInStage
}

export async function getVelocity(userId) {
  const weeks = get8WeeksStartDatesUTC()
  const startLimit = weeks[0]

  const rows = await prisma.$queryRaw`
    SELECT date_trunc('week', "createdAt") AS week, COUNT(*) AS count
    FROM "Application"
    WHERE "userId" = ${userId}
      AND "createdAt" >= ${startLimit}
    GROUP BY 1
    ORDER BY 1
  `

  const velocity = weeks.map((w) => {
    const match = rows.find((r) => {
      const rWeek = new Date(r.week)
      return rWeek.getTime() === w.getTime()
    })
    return {
      week: w.toISOString(),
      count: match ? Number(match.count) : 0,
    }
  })

  return velocity
}

export async function getLlmCost(userId) {
  const weeks = get8WeeksStartDatesUTC()
  const startLimit = weeks[0]

  const rows = await prisma.$queryRaw`
    SELECT date_trunc('week', "createdAt") AS week, SUM("costUsd") AS total
    FROM "Analysis"
    WHERE "applicationId" IN (
      SELECT id FROM "Application" WHERE "userId" = ${userId}
    )
      AND "createdAt" >= ${startLimit}
    GROUP BY 1
    ORDER BY 1
  `

  const byWeek = weeks.map((w) => {
    const match = rows.find((r) => {
      const rWeek = new Date(r.week)
      return rWeek.getTime() === w.getTime()
    })
    return {
      week: w.toISOString(),
      costUsd: match ? parseFloat(match.total || '0') : 0,
    }
  })

  // Get start of current month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const monthlyCostAggregate = await prisma.analysis.aggregate({
    where: {
      application: { userId },
      createdAt: { gte: startOfMonth },
    },
    _sum: {
      costUsd: true,
    },
  })

  const totalThisMonth = monthlyCostAggregate._sum.costUsd ? Number(monthlyCostAggregate._sum.costUsd) : 0

  return {
    byWeek,
    totalThisMonth,
  }
}
