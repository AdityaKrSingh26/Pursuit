import { z } from 'zod'

export const JobScoreSchema = z.array(
  z.object({
    job_number: z.number(),
    score: z.number().min(0).max(100),
    score_reason: z.string(),
    tech_stack: z.array(z.string()).default([]),
    exp_match: z.boolean().default(true),
  })
)
