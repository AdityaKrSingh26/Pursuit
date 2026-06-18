import { z } from 'zod'

export const JdStructuredSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  employmentType: z.string().nullable(),
  yoeMin: z.number().nullable(),
  yoeMax: z.number().nullable(),
  skills: z.array(z.string()),
  niceToHave: z.array(z.string()),
  responsibilities: z.array(z.string()),
  salaryText: z.string().nullable(),
  applyDeadline: z.string().nullable(),
})
