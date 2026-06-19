import { prisma } from '../../lib/db.js'
import { env } from '../../lib/env.js'

export async function embeddingProcessor(job) {
  const { jdId } = job.data
  const jd = await prisma.jobDescription.findUnique({ where: { id: jdId } })
  if (!jd || !jd.rawText) return

  const embeddingModel = env.EMBEDDING_MODEL || 'text-embedding-3-small'

  let vector
  if (!env.LLM_API_KEY || env.LLM_API_KEY === 'dummy-key') {
    console.warn('LLM_API_KEY is not set or dummy. Using mock embedding vector for development.')
    vector = Array.from({ length: 1536 }, () => Math.random() - 0.5)
  } else {
    try {
      const response = await global.fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.LLM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: jd.rawText.slice(0, 8000),
        }),
      })
      if (!response.ok) {
        throw new Error(`Embedding API failed with status ${response.status}: ${await response.text()}`)
      }
      const data = await response.json()
      if (data && data.data && data.data[0] && data.data[0].embedding) {
        vector = data.data[0].embedding
      } else {
        throw new Error('Invalid embedding response format')
      }
    } catch (err) {
      console.error('Failed to fetch embeddings from API:', err)
      console.warn('Falling back to mock embedding vector.')
      vector = Array.from({ length: 1536 }, () => Math.random() - 0.5)
    }
  }

  // Ensure dimension is exactly 1536
  if (vector.length !== 1536) {
    if (vector.length < 1536) {
      while (vector.length < 1536) {
        vector.push(0)
      }
    } else {
      vector = vector.slice(0, 1536)
    }
  }

  // Store via raw SQL — Prisma doesn't support vector type natively
  await prisma.$executeRaw`
    UPDATE "JobDescription"
    SET embedding = ${`[${vector.join(',')}]`}::vector
    WHERE id = ${jd.id}
  `
}
