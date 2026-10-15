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

    // Global dedup: jdHash is unique. A pending row cannot take a hash
    // another JD already owns — retarget applications and drop the pending row.
    const existing = await prisma.jobDescription.findFirst({
      where: { jdHash, id: { not: jdId } },
    })
    if (existing) {
      await prisma.application.updateMany({
        where: { jdId },
        data: { jdId: existing.id },
      })
      await prisma.jobDescription.delete({ where: { id: jdId } })
      await embeddingQueue.add('embed', { jdId: existing.id })
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
