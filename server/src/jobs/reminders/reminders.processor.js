import { prisma } from '../../lib/db.js'
import { env } from '../../lib/env.js'
import { isoWeekKey } from '../../lib/dateUtils.js'
import { callLlm } from '../../llm/llm.service.js'
import { VERSION, buildReminderEmailPrompt, ReminderEmailSchema } from '../../prompts/reminder-email.js'

export async function remindersProcessor() {
  const threshold = env.REMINDER_DAYS_THRESHOLD || 7
  const cutoff = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000)

  // Find applications in active stages with no recent stage change
  const staleApps = await prisma.$queryRaw`
    SELECT a.id, a."userId", a.company, a."roleTitle", a.stage,
           COALESCE(
             (SELECT MAX(se.at) FROM "StageEvent" se WHERE se."applicationId" = a.id),
             a."createdAt"
           ) AS "lastEventAt"
    FROM "Application" a
    WHERE a.stage IN ('APPLIED', 'OA', 'TECH', 'HR')
      AND a."createdAt" <= ${cutoff}
      AND NOT EXISTS (
        SELECT 1 FROM "StageEvent" se
        WHERE se."applicationId" = a.id
          AND se.at > ${cutoff}
      )
  `

  for (const app of staleApps) {
    const windowKey = `${app.stage}:${isoWeekKey(new Date())}`

    // Check if reminder already exists for this window
    const existing = await prisma.reminder.findFirst({
      where: { applicationId: app.id, windowKey },
    })
    if (existing) continue // already processed this week

    // Draft follow-up email via LLM
    const lastEventDate = new Date(app.lastEventAt)
    const daysSince = Math.round((Date.now() - lastEventDate.getTime()) / (24 * 60 * 60 * 1000))
    
    let draftEmail = null
    try {
      const result = await callLlm({
        systemPrompt: 'You are a professional email writer.',
        userMessage: buildReminderEmailPrompt(app.company, app.roleTitle, daysSince),
        schema: ReminderEmailSchema,
        applicationId: app.id,
        kind: 'PREP', // reuse PREP kind for cost tracking
        jdHash: '',
        promptVersion: VERSION,
      })
      draftEmail = `Subject: ${result.subject}\n\n${result.body}`
    } catch (err) {
      console.error(`Failed to generate follow-up email for app ${app.id}:`, err)
      // proceed without draft
    }

    await prisma.reminder.create({
      data: {
        applicationId: app.id,
        windowKey,
        draftEmail,
      },
    })
  }
}
