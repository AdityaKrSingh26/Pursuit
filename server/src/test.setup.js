import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../.env') })

// Allow unit tests to import modules that parse env without a local .env.
process.env.DATABASE_URL ??= 'postgresql://pursuit:pursuit@127.0.0.1:5434/pursuit'
process.env.REDIS_URL ??= 'redis://127.0.0.1:6381'
process.env.JWT_SECRET ??= 'test-jwt-secret-16ch'
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-16'
process.env.LLM_PROVIDER ??= 'openai'
process.env.LLM_API_KEY ??= 'test-llm-api-key'
