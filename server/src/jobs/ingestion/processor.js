import { prisma } from '../../lib/db.js'
import { fetchAndExtract } from './fetcher.js'
import { parseJd } from './jdParser.js'
import { computeJdHash } from '../../lib/jdHash.js'
import { embeddingQueue } from '../embedding/embedding.queue.js'

export async function ingestionProcessor(job) {
  const { jdId } = job.data
  const jd = await prisma.jobDescription.findUniqueOrThrow({ where: { id: jdId } })

  try {
    let rawText = jd.rawText
    if (jd.sourceUrl && !rawText) {
      await prisma.jobDescription.update({
        where: { id: jdId },
        data: { parseStatus: 'FETCHING' },
      })
      const fetched = await fetchAndExtract(jd.sourceUrl)
      rawText = fetched.rawText
      await prisma.jobDescription.update({
        where: { id: jdId },
        data: { rawText },
      })
    }

    await prisma.jobDescription.update({
      where: { id: jdId },
      data: { parseStatus: 'PARSING' },
    })

    const jdHash = computeJdHash(rawText)

    // Idempotency: check for existing entry with same hash
    const existing = await prisma.jobDescription.findFirst({
      where: { userId: jd.userId, jdHash, id: { not: jdId } },
    })
    if (existing) {
      await prisma.jobDescription.update({
        where: { id: jdId },
        data: { parseStatus: 'DONE', jdHash, structured: existing.structured },
      })
      await embeddingQueue.add('embed', { jdId })
      return
    }

    const structured = await parseJd(rawText)
    await prisma.jobDescription.update({
      where: { id: jdId },
      data: { parseStatus: 'DONE', structured, jdHash },
    })
    await embeddingQueue.add('embed', { jdId })
  } catch (e) {
    await prisma.jobDescription.update({
      where: { id: jdId },
      data: { parseStatus: 'FAILED', parseError: e.message },
    })
    throw e
  }
}
