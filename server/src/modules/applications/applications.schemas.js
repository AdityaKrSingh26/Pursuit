import { z } from 'zod'
import { Stage } from '@prisma/client'

export const CreateApplicationSchema = z.object({
  url: z.string().url().optional(),
  rawJd: z.string().optional(),
  company: z.string().min(1),
  roleTitle: z.string().min(1),
  source: z.string().optional(),
  salaryText: z.string().optional(),
  location: z.string().optional(),
  deadline: z.string().datetime().optional(),
})

export const UpdateApplicationSchema = z.object({
  stage: z.nativeEnum(Stage).optional(),
  notes: z.string().optional(),
  nextActionAt: z.string().datetime().optional().nullable(),
  company: z.string().min(1).optional(),
  roleTitle: z.string().min(1).optional(),
  source: z.string().optional(),
})

export const ListApplicationsSchema = z.object({
  stage: z.nativeEnum(Stage).optional(),
  q: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})
