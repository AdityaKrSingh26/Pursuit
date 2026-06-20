import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  LLM_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  LLM_BASE_URL: z.string().optional(),
  LLM_API_KEY: z.string(),
  LLM_MODEL: z.string().default('claude-sonnet-4-6'),
  LLM_MAX_TOKENS: z.coerce.number().default(2000),
  EMBEDDING_BASE_URL: z.string().optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().default(3001),
  REMINDER_DAYS_THRESHOLD: z.coerce.number().default(7),
  TINYFISH_API_KEY: z.string().optional(),
})

export const env = schema
  .superRefine((data, ctx) => {
    if (data.LLM_PROVIDER === 'anthropic' && !data.EMBEDDING_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['EMBEDDING_API_KEY'],
        message: 'EMBEDDING_API_KEY is required when LLM_PROVIDER=anthropic (LLM_API_KEY is an Anthropic key and will be rejected by the OpenAI embeddings API)',
      })
    }
    // If LLM is set to a custom OpenAI-compatible endpoint (like Groq) but embedding remains OpenAI default, we need a separate key.
    const isCustomLlmBaseUrl = data.LLM_BASE_URL && !data.LLM_BASE_URL.includes('api.openai.com')
    const isDefaultEmbeddingBaseUrl = !data.EMBEDDING_BASE_URL || data.EMBEDDING_BASE_URL.includes('api.openai.com')
    if (data.LLM_PROVIDER === 'openai' && isCustomLlmBaseUrl && isDefaultEmbeddingBaseUrl && !data.EMBEDDING_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['EMBEDDING_API_KEY'],
        message: 'EMBEDDING_API_KEY is required when using a custom LLM_BASE_URL with the default OpenAI embedding service',
      })
    }
  })
  .parse(process.env)

