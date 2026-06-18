import { z } from 'zod'

export const GapAnalysisSchema = z.object({
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  partialSkills: z.array(z.string()),
  bulletRanking: z.array(
    z.object({
      blockId: z.string(),
      relevanceScore: z.number().min(0).max(100),
      reason: z.string(),
    })
  ),
  riskQuestions: z.array(z.string()),
  overallSummary: z.string(),
  llmRelevanceScore: z.number().min(0).max(100),
})
