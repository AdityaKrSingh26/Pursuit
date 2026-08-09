import { prisma } from '../../lib/db.js'
import { parseResume } from './resumeParser.js'

export async function resumeUploadProcessor(job) {
  const { resumeUploadId } = job.data
  const upload = await prisma.resumeUpload.findUniqueOrThrow({ where: { id: resumeUploadId } })

  try {
    await prisma.resumeUpload.update({ where: { id: upload.id }, data: { status: 'PARSING' } })

    const blocks = await parseResume(upload.rawText)

    const maxOrder = await prisma.resumeBlock.aggregate({
      where: { userId: upload.userId },
      _max: { orderDefault: true },
    })
    let order = (maxOrder._max.orderDefault ?? -1) + 1

    for (const b of blocks) {
      await prisma.resumeBlock.create({
        data: {
          userId: upload.userId,
          section: b.section,
          content: JSON.stringify(b.content),
          skillTags: b.skillTags,
          orderDefault: order++,
        },
      })
    }

    await prisma.resumeUpload.update({
      where: { id: upload.id },
      data: { status: 'DONE', blocksCreated: blocks.length },
    })
  } catch (e) {
    await prisma.resumeUpload.update({
      where: { id: upload.id },
      data: { status: 'FAILED', error: e.message },
    })
    throw e
  }
}
