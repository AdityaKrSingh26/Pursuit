import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('claude-sonnet-4-6'),
  LLM_MAX_TOKENS: z.coerce.number().default(2000),
  EMBEDDING_MODEL: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_KEY: z.string().optional(),
  STORAGE_SECRET: z.string().optional(),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().default(3001),
  REMINDER_DAYS_THRESHOLD: z.coerce.number().default(7),
})

export const env = schema.parse(process.env)
