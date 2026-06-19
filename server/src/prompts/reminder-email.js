import { z } from 'zod'

export const VERSION = 'reminder-v1'

export function buildReminderEmailPrompt(company, role, daysSinceUpdate) {
  return `Draft a brief, professional follow-up email for a job application.
Company: ${company}
Role: ${role}
Days since last update: ${daysSinceUpdate}

Return ONLY valid JSON:
{ "subject": string, "body": string }

The email should be 3-4 sentences, polite, and express continued interest without desperation.`
}

export const ReminderEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
})
