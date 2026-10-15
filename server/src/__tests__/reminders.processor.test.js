import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/env.js', () => ({
  env: { REMINDER_DAYS_THRESHOLD: 7 },
}))

vi.mock('../lib/db.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    reminder: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    analysis: { create: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('../llm/llm.service.js', () => ({
  callLlm: vi.fn(),
}))

import { prisma } from '../lib/db.js'
import { callLlm } from '../llm/llm.service.js'
import { remindersProcessor } from '../jobs/reminders/reminders.processor.js'
import { listPendingReminders } from '../modules/reminders/reminders.service.js'

describe('remindersProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.reminder.findFirst.mockResolvedValue(null)
    prisma.reminder.create.mockResolvedValue({})
    callLlm.mockResolvedValue({ subject: 'Follow up', body: 'Hello' })
  })

  it('does not persist the draft email as a PREP analysis', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'app-1',
        userId: 'user-1',
        company: 'Acme',
        roleTitle: 'Engineer',
        stage: 'APPLIED',
        lastEventAt: new Date('2026-01-01'),
      },
    ])

    await remindersProcessor()

    expect(callLlm).toHaveBeenCalledWith(expect.objectContaining({ persist: false }))
    expect(prisma.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'app-1',
        draftEmail: expect.stringContaining('Follow up'),
      }),
    })
  })

  it('skips soft-deleted applications in the stale query', async () => {
    prisma.$queryRaw.mockResolvedValue([])
    await remindersProcessor()
    const sql = String(prisma.$queryRaw.mock.calls[0][0])
    expect(sql).toMatch(/deletedAt/i)
  })
})

describe('listPendingReminders', () => {
  it('scopes to live applications only', async () => {
    prisma.reminder.findMany.mockResolvedValue([])
    await listPendingReminders('user-1')
    expect(prisma.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          application: expect.objectContaining({
            userId: 'user-1',
            deletedAt: null,
          }),
        }),
      }),
    )
  })
})
