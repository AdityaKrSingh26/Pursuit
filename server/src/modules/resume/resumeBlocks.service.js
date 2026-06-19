import { prisma } from '../../lib/db.js'
import { AppError } from '../../lib/errors.js'

export async function getBlocks(userId) {
  return prisma.resumeBlock.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ section: 'asc' }, { orderDefault: 'asc' }],
  })
}

export async function createBlock(userId, data) {
  return prisma.resumeBlock.create({
    data: { userId, ...data },
  })
}

export async function updateBlock(userId, blockId, data) {
  const block = await prisma.resumeBlock.findUnique({ where: { id: blockId } })
  if (!block) throw AppError.notFound('Block not found')
  if (block.userId !== userId) throw AppError.forbidden('Forbidden')
  return prisma.resumeBlock.update({
    where: { id: blockId },
    data,
  })
}

export async function archiveBlock(userId, blockId) {
  const block = await prisma.resumeBlock.findUnique({ where: { id: blockId } })
  if (!block) throw AppError.notFound('Block not found')
  if (block.userId !== userId) throw AppError.forbidden('Forbidden')
  return prisma.resumeBlock.update({
    where: { id: blockId },
    data: { archivedAt: new Date() },
  })
}

export async function reorderBlocks(userId, updates) {
  // Verify all block IDs belong to this user before updating
  const ids = updates.map((u) => u.id)
  const blocks = await prisma.resumeBlock.findMany({
    where: { id: { in: ids } },
    select: { id: true, userId: true },
  })
  for (const block of blocks) {
    if (block.userId !== userId) throw AppError.forbidden('Forbidden')
  }
  if (blocks.length !== ids.length) throw AppError.notFound('One or more blocks not found')

  await prisma.$transaction(
    updates.map((u) =>
      prisma.resumeBlock.update({
        where: { id: u.id },
        data: { orderDefault: u.orderDefault },
      })
    )
  )
}
