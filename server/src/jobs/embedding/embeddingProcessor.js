import { prisma } from '../../lib/db.js'
import { embed } from '../../lib/llm.js'

export async function embeddingProcessor(job) {
  const { jdId } = job.data
  const jd = await prisma.jobDescription.findUnique({ where: { id: jdId } })
  if (!jd || !jd.rawText) {
    return
  }

  let vector = await embed(jd.rawText.slice(0, 8000))

  if (vector.length < 1536) {
    while (vector.length < 1536) vector.push(0)
  } else if (vector.length > 1536) {
    vector = vector.slice(0, 1536)
  }

  await prisma.$executeRaw`
    UPDATE "JobDescription"
    SET embedding = ${`[${vector.join(',')}]`}::vector
    WHERE id = ${jd.id}
  `
}
