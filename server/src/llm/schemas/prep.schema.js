import { z } from 'zod'

const QuestionSchema = z.object({
  text: z.string(),
  reason: z.string(),
})

export const PrepSchema = z.object({
  technicalQuestions: z.array(QuestionSchema),
  behavioralQuestions: z.array(QuestionSchema),
  gapProbes: z.array(QuestionSchema),
  companyAngle: z.string(),
})
