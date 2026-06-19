import { z } from 'zod'

export const TailoringSchema = z.object({
  proposals: z.array(
    z.object({
      blockId: z.string(),
      action: z.enum(['include', 'exclude', 'rewrite']),
      rewrittenContent: z.string().nullable(),
      reason: z.string(),
    })
  ),
})
