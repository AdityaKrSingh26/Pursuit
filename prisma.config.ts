import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Install pgvector in the shadow DB so `Unsupported("vector(1536)")` works during migrate dev
    initShadowDb: 'CREATE EXTENSION IF NOT EXISTS vector;',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
  experimental: {
    externalTables: true,
  },
})
